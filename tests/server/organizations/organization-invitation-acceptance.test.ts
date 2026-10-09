import { describe, expect, it, vi } from "vitest";

const fakeDb = vi.hoisted(() => ({ transaction: vi.fn() }));
const actionMocks = vi.hoisted(() => ({ getCurrentSession: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/db/drizzle", () => ({ db: fakeDb }));
vi.mock("@/features/auth/server", () => ({ getCurrentSession: actionMocks.getCurrentSession }));
vi.mock("next/cache", () => ({ revalidatePath: actionMocks.revalidatePath }));

import {
  allowlistGrant,
  authorizationAudit,
  invitation,
  member,
  membershipRole,
  organization,
  role,
  user,
} from "@/db/schema";
import { acceptOrganizationInvitationAction } from "../../../src/features/organizations/actions/respond-to-organization-invitation";
import { acceptOrganizationInvitation } from "../../../src/features/organizations/lib/respond-to-organization-invitation";

const invitationRow = {
  id: "opaque-capability",
  organizationId: "org-1",
  email: "recipient@example.com",
  roleId: "custom-role-1",
  status: "pending",
  expiresAt: new Date("2032-04-07T00:00:00.000Z"),
};
const identityRow = {
  id: "user-1",
  email: "recipient@example.com",
  emailVerified: true,
  disabledAt: null,
  isOrganizationRestricted: false,
  managingOrganizationId: null,
  managingOrganizationIdSnapshot: null,
  allowlistFrozenAt: null,
};

function installExecutor(
  overrides: {
    status?: string;
    activeCount?: number;
    transition?: boolean;
    invitation?: Partial<typeof invitationRow>;
    identity?: Record<string, unknown>;
    storedRole?: Record<string, unknown> | null;
    existingMembership?: Record<string, unknown> | null;
    assignedRole?: boolean;
    assignedRoleId?: string;
    grants?: unknown[];
    failInsert?: "role" | "audit";
    throwTransition?: boolean;
  } = {}
) {
  const state = {
    invitation: {
      ...invitationRow,
      ...overrides.invitation,
      status: overrides.status ?? overrides.invitation?.status ?? "pending",
    },
    members: [] as Array<Record<string, unknown>>,
    assignments: [] as Array<Record<string, unknown>>,
    audits: [] as Array<Record<string, unknown>>,
    events: [] as string[],
  };
  let lockTail = Promise.resolve();
  const executor = {
    releaseInvitationLock: undefined as (() => void) | undefined,
    select: (projection: Record<string, unknown>) => {
      let table: unknown;
      let lockInvitation = false;
      const query = {
        from(value: unknown) {
          table = value;
          return query;
        },
        where() {
          return query;
        },
        limit() {
          return query;
        },
        for() {
          state.events.push("lock");
          lockInvitation = table === invitation;
          return query;
        },
        async then(resolve: (rows: unknown[]) => unknown) {
          if (lockInvitation) {
            const previous = lockTail;
            let unlock!: () => void;
            lockTail = new Promise<void>((release) => (unlock = release));
            await previous;
            executor.releaseInvitationLock = unlock;
          }
          let rows: unknown[] = [];
          if (table === invitation) rows = [state.invitation];
          else if (table === user) rows = [{ ...identityRow, ...overrides.identity }];
          else if (table === organization) rows = [{ id: "org-1", slug: "acme", name: "Acme" }];
          else if (table === role)
            rows =
              overrides.storedRole === null
                ? []
                : [
                    overrides.storedRole ?? {
                      id: "custom-role-1",
                      scope: "organization",
                      organizationId: "org-1",
                      isProtected: false,
                    },
                  ];
          else if (table === member && "count" in projection) {
            state.events.push("count");
            rows = [{ count: overrides.activeCount ?? 3 }];
          } else if (table === member)
            rows = overrides.existingMembership ? [overrides.existingMembership] : state.members;
          else if (table === membershipRole)
            rows =
              overrides.assignedRole &&
              (overrides.assignedRoleId ?? "custom-role-1") === "custom-role-1"
                ? [{ roleId: "custom-role-1" }]
                : state.assignments;
          else if (table === allowlistGrant) rows = overrides.grants ?? [];
          return Promise.resolve(rows).then(resolve);
        },
      };
      return query;
    },
    insert: (table: unknown) => ({
      values: async (value: Record<string, unknown>) => {
        if (table === member) {
          state.events.push("member");
          state.members.push(value);
        }
        if (table === membershipRole) {
          state.events.push("role");
          state.assignments.push(value);
          if (overrides.failInsert === "role") throw new Error("role insert failed");
        }
        if (table === authorizationAudit) {
          state.events.push("audit");
          state.audits.push(value);
          if (overrides.failInsert === "audit") throw new Error("audit insert failed");
        }
      },
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            state.events.push("transition");
            if (overrides.throwTransition) throw new Error("invitation update failed");
            if (overrides.transition === false) return [];
            Object.assign(state.invitation, values);
            return [{ id: state.invitation.id }];
          },
        }),
      }),
    }),
  };
  fakeDb.transaction.mockImplementation(async (callback) => {
    const snapshot = structuredClone({
      invitation: state.invitation,
      members: state.members,
      assignments: state.assignments,
      audits: state.audits,
    });
    try {
      return await callback(executor);
    } catch (error) {
      Object.assign(state, snapshot);
      throw error;
    } finally {
      executor.releaseInvitationLock?.();
      executor.releaseInvitationLock = undefined;
    }
  });
  return state;
}

describe("organization invitation acceptance service", () => {
  it("creates lifecycle member plus stored role ID, transitions, then audits a digest", async () => {
    const state = installExecutor();
    await expect(acceptOrganizationInvitation(invitationRow.id, "user-1")).resolves.toEqual({
      changed: true,
      invitationId: invitationRow.id,
    });
    expect(state.events).toEqual(
      expect.arrayContaining(["lock", "member", "role", "transition", "audit"])
    );
    expect(state.events.indexOf("member")).toBeLessThan(state.events.indexOf("role"));
    expect(state.events.indexOf("role")).toBeLessThan(state.events.indexOf("transition"));
    expect(state.events.indexOf("transition")).toBeLessThan(state.events.indexOf("audit"));
    expect(state.events.lastIndexOf("lock")).toBeLessThan(state.events.indexOf("count"));
    expect(state.events.indexOf("count")).toBeLessThan(state.events.indexOf("member"));
    expect(state.members[0]).toMatchObject({
      organizationId: "org-1",
      userId: "user-1",
      role: "member",
      status: "active",
    });
    expect(state.assignments[0]).toMatchObject({
      roleId: "custom-role-1",
      assignedByMembershipId: null,
    });
    expect(state.audits[0]).toMatchObject({
      actorUserId: "user-1",
      actorMembershipId: null,
      targetType: "invitation",
    });
    expect(state.audits[0]?.targetId).not.toBe(invitationRow.id);
    expect(JSON.stringify(state.audits[0])).not.toContain(invitationRow.id);
  });

  it("rolls back the member and role writes when the conditional invitation transition loses", async () => {
    const state = installExecutor({ transition: false });
    await expect(acceptOrganizationInvitation(invitationRow.id, "user-1")).rejects.toThrow(
      "INVITATION_TRANSITION_CONFLICT"
    );
    expect(state.members).toHaveLength(0);
    expect(state.assignments).toHaveLength(0);
    expect(state.audits).toHaveLength(0);
    expect(state.invitation.status).toBe("pending");
  });

  it.each([
    [{ failInsert: "role" as const }, "role insert failed"],
    [{ throwTransition: true }, "invitation update failed"],
    [{ failInsert: "audit" as const }, "audit insert failed"],
  ])(
    "rolls back all acceptance writes when a transaction step fails (%s)",
    async (overrides, message) => {
      const state = installExecutor(overrides);
      await expect(acceptOrganizationInvitation(invitationRow.id, "user-1")).rejects.toThrow(
        message
      );
      expect(state.members).toHaveLength(0);
      expect(state.assignments).toHaveLength(0);
      expect(state.invitation.status).toBe("pending");
      expect(state.audits).toHaveLength(0);
    }
  );

  it.each([
    [{ identity: { email: "elsewhere@example.com" } }, "INVITATION_RECIPIENT_MISMATCH"],
    [{ identity: { emailVerified: false } }, "EMAIL_NOT_VERIFIED"],
    [{ identity: { disabledAt: new Date() } }, "UNAUTHORIZED"],
    [{ storedRole: null }, "INVITATION_ROLE_INVALID"],
    [
      {
        storedRole: {
          id: "custom-role-1",
          scope: "organization",
          organizationId: "other-org",
          isProtected: false,
        },
      },
      "INVITATION_ROLE_INVALID",
    ],
    [
      { existingMembership: { id: "existing", role: "member", status: "active" } },
      "INVITATION_STATE_INVARIANT",
    ],
    [{ activeCount: 1000 }, "ORGANIZATION_MEMBER_LIMIT_REACHED"],
  ] as const)("denies acceptance for invalid current state (%s)", async (overrides, expected) => {
    installExecutor(overrides);
    await expect(acceptOrganizationInvitation(invitationRow.id, "user-1")).rejects.toThrow(
      expected
    );
  });

  it.each([
    [{ id: "active-existing", role: "member", status: "active" }],
    [{ id: "suspended-existing", role: "member", status: "suspended" }],
  ])(
    "rejects a pending invitation with an existing canonical membership without writes (%s)",
    async (existingMembership) => {
      const state = installExecutor({ existingMembership });

      await expect(acceptOrganizationInvitation(invitationRow.id, "user-1")).rejects.toThrow(
        "INVITATION_STATE_INVARIANT"
      );

      expect(state.events).not.toContain("member");
      expect(state.events).not.toContain("role");
      expect(state.events).not.toContain("transition");
      expect(state.events).not.toContain("audit");
      expect(state.members).toHaveLength(0);
      expect(state.assignments).toHaveLength(0);
      expect(state.invitation.status).toBe("pending");
      expect(state.audits).toHaveLength(0);
    }
  );

  it.each([
    [null, false],
    [{ id: "wrong-lifecycle", role: "owner", status: "active" }, true],
    [{ id: "suspended", role: "member", status: "suspended" }, true],
  ])(
    "rejects accepted invitation without the exact active member projection (%s)",
    async (existingMembership, assignedRole) => {
      const state = installExecutor({
        status: "accepted",
        existingMembership: existingMembership ?? undefined,
        assignedRole,
      });

      await expect(acceptOrganizationInvitation(invitationRow.id, "user-1")).rejects.toThrow(
        "INVITATION_STATE_INVARIANT"
      );
      expect(state.members).toHaveLength(0);
      expect(state.assignments).toHaveLength(0);
      expect(state.invitation.status).toBe("accepted");
      expect(state.audits).toHaveLength(0);
    }
  );

  it("accepts when 999 members are active and returns idempotently only for the exact accepted assignment", async () => {
    installExecutor({ activeCount: 999 });
    await expect(acceptOrganizationInvitation(invitationRow.id, "user-1")).resolves.toMatchObject({
      changed: true,
    });

    const state = installExecutor({
      status: "accepted",
      existingMembership: { id: "existing", role: "member", status: "active" },
      assignedRole: true,
    });
    await expect(acceptOrganizationInvitation(invitationRow.id, "user-1")).resolves.toEqual({
      changed: false,
      invitationId: invitationRow.id,
    });
    expect(state.events).not.toContain("count");
    expect(state.events).not.toContain("member");
    expect(state.events).not.toContain("role");
    expect(state.events).not.toContain("transition");
    expect(state.events).not.toContain("audit");
    expect(state.members).toHaveLength(0);
    expect(state.assignments).toHaveLength(0);
    expect(state.audits).toHaveLength(0);

    installExecutor({
      status: "accepted",
      existingMembership: { id: "existing", role: "member", status: "active" },
      assignedRole: true,
      assignedRoleId: "other-role",
    });
    await expect(acceptOrganizationInvitation(invitationRow.id, "user-1")).rejects.toThrow(
      "INVITATION_STATE_INVARIANT"
    );
  });

  it("accepts a global protected role and rejects a protected role scoped to an organization", async () => {
    installExecutor({
      invitation: { roleId: "system:organization:owner" },
      storedRole: {
        id: "system:organization:owner",
        scope: "organization",
        organizationId: null,
        isProtected: true,
      },
    });
    await expect(acceptOrganizationInvitation(invitationRow.id, "user-1")).resolves.toMatchObject({
      changed: true,
    });

    const state = installExecutor({
      invitation: { roleId: "custom-owner" },
      storedRole: {
        id: "custom-owner",
        scope: "organization",
        organizationId: "org-1",
        isProtected: true,
      },
    });
    await expect(acceptOrganizationInvitation(invitationRow.id, "user-1")).rejects.toThrow(
      "INVITATION_ROLE_INVALID"
    );
    expect(state.members).toHaveLength(0);
    expect(state.invitation.status).toBe("pending");
  });

  it("permits restricted live-manager and explicit grant recipients and frozen snapshot grants", async () => {
    installExecutor({
      identity: { isOrganizationRestricted: true, managingOrganizationId: "org-1" },
    });
    await expect(acceptOrganizationInvitation(invitationRow.id, "user-1")).resolves.toMatchObject({
      changed: true,
    });
    installExecutor({
      identity: { isOrganizationRestricted: true, managingOrganizationId: "manager-org" },
      grants: [{ id: "grant-1" }],
    });
    await expect(acceptOrganizationInvitation(invitationRow.id, "user-1")).resolves.toMatchObject({
      changed: true,
    });
    installExecutor({
      identity: {
        isOrganizationRestricted: true,
        managingOrganizationId: null,
        managingOrganizationIdSnapshot: "manager-org",
        allowlistFrozenAt: new Date(),
      },
      grants: [{ id: "frozen-grant", grantingOrganizationIdSnapshot: "manager-org" }],
    });
    await expect(acceptOrganizationInvitation(invitationRow.id, "user-1")).resolves.toMatchObject({
      changed: true,
    });
    const state = installExecutor({
      identity: {
        isOrganizationRestricted: true,
        managingOrganizationId: null,
        managingOrganizationIdSnapshot: "manager-org",
        allowlistFrozenAt: new Date(),
      },
    });
    await expect(acceptOrganizationInvitation(invitationRow.id, "user-1")).rejects.toThrow(
      "ORGANIZATION_RESTRICTED"
    );
    expect(state.members).toHaveLength(0);
    expect(state.invitation.status).toBe("pending");
  });

  it("serializes competing accepts so only one creates the membership projection", async () => {
    const state = installExecutor();
    const results = await Promise.all([
      acceptOrganizationInvitation(invitationRow.id, "user-1"),
      acceptOrganizationInvitation(invitationRow.id, "user-1"),
    ]);

    expect(results).toEqual([
      { changed: true, invitationId: invitationRow.id },
      { changed: false, invitationId: invitationRow.id },
    ]);
    expect(state.members).toHaveLength(1);
    expect(state.assignments).toHaveLength(1);
    expect(state.audits).toHaveLength(1);
  });

  it("requires a session and preserves the active organization during acceptance", async () => {
    vi.clearAllMocks();
    actionMocks.getCurrentSession.mockResolvedValueOnce(null);
    await expect(
      acceptOrganizationInvitationAction({ invitationId: "opaque-capability" })
    ).resolves.toEqual({ success: false, code: "UNAUTHORIZED" });
    expect(fakeDb.transaction).not.toHaveBeenCalled();

    const session = { user: { id: "user-1" }, session: { activeOrganizationId: "personal-org" } };
    actionMocks.getCurrentSession.mockResolvedValueOnce(session);
    installExecutor();
    await expect(
      acceptOrganizationInvitationAction({ invitationId: "opaque-capability" })
    ).resolves.toMatchObject({ success: true, data: { changed: true } });
    expect(session.session.activeOrganizationId).toBe("personal-org");
    expect(actionMocks.revalidatePath).toHaveBeenCalledWith("/org");
  });

  it("accepts a two-day invitation immediately before its exact expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2032-04-05T00:00:00.000Z"));
    installExecutor();
    await expect(acceptOrganizationInvitation(invitationRow.id, "user-1")).resolves.toMatchObject({
      changed: true,
    });
    vi.useRealTimers();
  });

  it("rejects an invitation exactly at its expiry timestamp", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(invitationRow.expiresAt);
    installExecutor();
    await expect(acceptOrganizationInvitation(invitationRow.id, "user-1")).rejects.toThrow(
      "INVITATION_EXPIRED"
    );
    vi.useRealTimers();
  });
});
