import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryResults: [] as unknown[][],
  updates: [] as Array<{ table: unknown; values: Record<string, unknown>; condition?: unknown }>,
  deletes: [] as Array<{ table: unknown; condition: unknown }>,
  inserts: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
  failAudit: false,
  failDeleteTable: undefined as unknown,
  simulatedCascades: [] as unknown[],
  deletedMembershipIds: new Set<string>(),
  enforceImmediateAuditMembershipFk: false,
  transaction: vi.fn(),
  capacity: vi.fn(),
  tables: {
    authorizationAudit: { table: "audit" },
    allowlistGrant: { table: "allowlistGrant" },
    account: { table: "account" },
    invitation: { table: "invitation" },
    member: {
      id: "member.id",
      userId: "member.userId",
      organizationId: "member.orgId",
      status: "member.status",
      role: "member.role",
    },
    membershipRole: {
      membershipId: "membershipRole.membershipId",
      roleId: "membershipRole.roleId",
    },
    organization: { id: "organization.id" },
    permission: { key: "permission.key" },
    role: {
      id: "role.id",
      key: "role.key",
      scope: "role.scope",
      organizationId: "role.organizationId",
      isProtected: "role.isProtected",
    },
    rolePermission: {
      roleId: "rolePermission.roleId",
      permissionKey: "rolePermission.permissionKey",
    },
    session: { userId: "session.userId", activeOrganizationId: "session.activeOrganizationId" },
    user: {
      id: "user.id",
      disabledAt: "user.disabledAt",
      name: "user.name",
      email: "user.email",
      username: "user.username",
      isOrganizationRestricted: "user.isOrganizationRestricted",
      managingOrganizationId: "user.managingOrganizationId",
    },
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("drizzle-orm", () => ({
  and: (...values: unknown[]) => ({ and: values }),
  count: () => "count",
  eq: (column: unknown, value: unknown) => ({ eq: [column, value] }),
  isNull: (column: unknown) => ({ isNull: column }),
  or: (...values: unknown[]) => ({ or: values }),
}));
vi.mock("@/db/schema", () => mocks.tables);
vi.mock("@/features/authorization/server", () => ({
  PERMISSIONS: {
    ORGANIZATION_MEMBER_ACCESS_UPDATE: "organization.members.access.update",
    ORGANIZATION_OWNERSHIP_TRANSFER: "organization.ownership.transfer",
    ORGANIZATION_MEMBERS_REMOVE: "organization.members.remove",
  },
}));
vi.mock("@/features/organizations/lib/active-member-capacity", () => ({
  assertActiveMemberCapacity: mocks.capacity,
}));
vi.mock("@/db/drizzle", () => ({ db: { transaction: mocks.transaction } }));

import {
  manageOrganizationMember,
  type OrganizationMemberActor,
} from "@/features/organizations/lib/manage-organization-members";

const actor: OrganizationMemberActor = {
  userId: "actor-user",
  membershipId: "actor-member",
  organizationId: "org-a",
  name: "Actor",
  email: "actor@example.com",
  username: "actor",
};
const grants = [
  { key: "organization.members.access.update" },
  { key: "organization.ownership.transfer" },
];

function query(result: unknown[]) {
  const chain = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    for: vi.fn(),
    limit: vi.fn(),
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(result).then(resolve),
  };
  chain.from.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.for.mockReturnValue(chain);
  chain.limit.mockResolvedValue(result);
  return chain;
}

function transactionClient() {
  return {
    select: vi.fn(() => query(mocks.queryResults.shift() ?? [])),
    update: vi.fn((table) => ({
      set: vi.fn((values) => ({
        where: vi.fn(async (condition) => mocks.updates.push({ table, values, condition })),
      })),
    })),
    delete: vi.fn((table) => ({
      where: vi.fn(async (condition) => {
        if (table === mocks.failDeleteTable) throw new Error("delete unavailable");
        mocks.deletes.push({ table, condition });
        if (table === mocks.tables.member) {
          const findMemberId = (predicate: unknown): string | undefined => {
            if (typeof predicate !== "object" || predicate === null) return undefined;
            if ("eq" in predicate && Array.isArray(predicate.eq)) {
              return predicate.eq[0] === mocks.tables.member.id
                ? String(predicate.eq[1])
                : undefined;
            }
            if ("and" in predicate && Array.isArray(predicate.and)) {
              for (const child of predicate.and) {
                const id = findMemberId(child);
                if (id) return id;
              }
            }
            return undefined;
          };
          const id = findMemberId(condition);
          if (id) mocks.deletedMembershipIds.add(id);
        }
        if (table === mocks.tables.user) {
          mocks.simulatedCascades.push(
            mocks.tables.session,
            mocks.tables.account,
            mocks.tables.allowlistGrant,
            mocks.tables.invitation
          );
        }
      }),
    })),
    insert: vi.fn((table) => ({
      values: vi.fn((values) => {
        if (table === mocks.tables.authorizationAudit && mocks.failAudit) {
          throw new Error("audit unavailable");
        }
        if (
          table === mocks.tables.authorizationAudit &&
          mocks.enforceImmediateAuditMembershipFk &&
          mocks.deletedMembershipIds.has(String(values.actorMembershipId))
        ) {
          throw new Error("immediate authorizationAudit.actorMembershipId FK violation");
        }
        mocks.inserts.push({ table, values });
        return { onConflictDoNothing: async () => undefined };
      }),
      onConflictDoNothing: async () => undefined,
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queryResults = [];
  mocks.updates = [];
  mocks.deletes = [];
  mocks.inserts = [];
  mocks.failAudit = false;
  mocks.failDeleteTable = undefined;
  mocks.simulatedCascades = [];
  mocks.deletedMembershipIds = new Set();
  mocks.enforceImmediateAuditMembershipFk = false;
  mocks.transaction.mockImplementation(async (callback) => {
    const before = {
      updates: mocks.updates.length,
      deletes: mocks.deletes.length,
      inserts: mocks.inserts.length,
      cascades: mocks.simulatedCascades.length,
      deletedMembershipIds: new Set(mocks.deletedMembershipIds),
    };
    try {
      return await callback(transactionClient());
    } catch (error) {
      mocks.updates.length = before.updates;
      mocks.deletes.length = before.deletes;
      mocks.inserts.length = before.inserts;
      mocks.simulatedCascades.length = before.cascades;
      mocks.deletedMembershipIds = new Set(before.deletedMembershipIds);
      throw error;
    }
  });
});

describe("organization membership lifecycle service", () => {
  it("suspends only the selected membership and clears only that org session", async () => {
    mocks.queryResults.push(
      [{ id: "org-a" }],
      grants,
      [{ id: "target-member", userId: "target-user", status: "active", disabledAt: null }],
      [{ total: 2 }],
      [{ membershipId: "another-owner" }]
    );
    const result = await manageOrganizationMember(actor, {
      kind: "access",
      memberId: "target-member",
      status: "suspended",
    });
    expect(result).toMatchObject({ status: "suspended", changed: true, identityDisabled: false });
    expect(mocks.updates).toContainEqual(
      expect.objectContaining({
        table: mocks.tables.member,
        values: expect.objectContaining({ status: "suspended", suspendedByUserId: actor.userId }),
      })
    );
    expect(mocks.updates).toContainEqual(
      expect.objectContaining({
        table: mocks.tables.session,
        values: { activeOrganizationId: null },
      })
    );
    expect(mocks.deletes).toEqual([]);
    expect(
      mocks.updates.some(
        (entry) =>
          entry.table === mocks.tables.membershipRole || entry.table === mocks.tables.allowlistGrant
      )
    ).toBe(false);
    expect(mocks.inserts).toContainEqual(
      expect.objectContaining({
        values: expect.objectContaining({
          action: "organization.member-suspended",
          actorMembershipId: actor.membershipId,
        }),
      })
    );
  });

  it("globally disables a sole-member identity but retains its suspended membership", async () => {
    mocks.queryResults.push(
      [{ id: "org-a" }],
      grants,
      [{ id: "target-member", userId: "target-user", status: "active", disabledAt: null }],
      [{ total: 1 }],
      [{ membershipId: "another-owner" }]
    );
    const result = await manageOrganizationMember(actor, {
      kind: "access",
      memberId: "target-member",
      status: "suspended",
    });
    expect(result).toMatchObject({ status: "suspended", identityDisabled: true });
    expect(mocks.updates).toContainEqual(
      expect.objectContaining({
        table: mocks.tables.user,
        values: { disabledAt: expect.any(Date) },
      })
    );
    expect(mocks.deletes).toContainEqual(expect.objectContaining({ table: mocks.tables.session }));
    expect(
      mocks.updates.some(
        (entry) => entry.table === mocks.tables.member && entry.values.status === "suspended"
      )
    ).toBe(true);
  });

  it("denies an actor suspending their own membership", async () => {
    mocks.queryResults.push(
      [{ id: "org-a" }],
      grants,
      [{ id: actor.membershipId, userId: actor.userId, status: "active", disabledAt: null }],
      [{ total: 1 }],
      [{ membershipId: "another-owner" }]
    );
    await expect(
      manageOrganizationMember(actor, {
        kind: "access",
        memberId: actor.membershipId,
        status: "suspended",
      })
    ).rejects.toThrow("SELF_SUSPEND_FORBIDDEN");
    expect(mocks.updates).toEqual([]);
  });

  it("denies suspending the last active owner", async () => {
    mocks.queryResults.push(
      [{ id: "org-a" }],
      grants,
      [{ id: "target-member", userId: "target-user", status: "active", disabledAt: null }],
      [{ total: 2 }],
      [{ membershipId: "target-member" }]
    );
    await expect(
      manageOrganizationMember(actor, {
        kind: "access",
        memberId: "target-member",
        status: "suspended",
      })
    ).rejects.toThrow("LAST_ACTIVE_ADMIN");
    expect(mocks.updates).toEqual([]);
  });

  it("allows suspension when Admin and legacy Owner memberships remain", async () => {
    mocks.queryResults.push(
      [{ id: "org-a" }],
      grants,
      [{ id: "target-member", userId: "target-user", status: "active", disabledAt: null }],
      [{ total: 2 }],
      [{ membershipId: "target-member" }, { membershipId: "admin-member" }]
    );
    await expect(
      manageOrganizationMember(actor, {
        kind: "access",
        memberId: "target-member",
        status: "suspended",
      })
    ).resolves.toMatchObject({ changed: true });
  });

  it("uses active capacity without enabling identity or creating sessions", async () => {
    mocks.queryResults.push([{ id: "org-a" }], grants, [
      { id: "target-member", userId: "target-user", status: "suspended", disabledAt: new Date() },
    ]);
    const result = await manageOrganizationMember(actor, {
      kind: "access",
      memberId: "target-member",
      status: "active",
    });
    expect(mocks.capacity).toHaveBeenCalledWith(expect.anything(), "org-a");
    expect(result).toMatchObject({ status: "active", identityDisabled: true });
    expect(mocks.updates.some((entry) => entry.table === mocks.tables.user)).toBe(false);
    expect(mocks.deletes).toEqual([]);
  });

  it("transfers ownership and preserves the source as admin in lifecycle projections", async () => {
    mocks.queryResults.push(
      [{ id: "org-a" }],
      grants,
      [{ id: "actor-member", role: "owner" }],
      [{ roleId: "role-owner" }],
      [{ id: "recipient-member", userId: "recipient-user" }],
      [{ id: "role-owner" }],
      [{ id: "role-admin" }]
    );
    const result = await manageOrganizationMember(actor, {
      kind: "transfer",
      recipientMemberId: "recipient-member",
    });
    expect(result).toEqual({
      sourceMemberId: "actor-member",
      recipientMemberId: "recipient-member",
      changed: true,
    });
    expect(mocks.inserts).toContainEqual(
      expect.objectContaining({
        table: mocks.tables.membershipRole,
        values: expect.objectContaining({ membershipId: "recipient-member", roleId: "role-owner" }),
      })
    );
    expect(mocks.inserts).toContainEqual(
      expect.objectContaining({
        table: mocks.tables.membershipRole,
        values: expect.objectContaining({ membershipId: "actor-member", roleId: "role-admin" }),
      })
    );
    expect(mocks.deletes).toContainEqual(
      expect.objectContaining({ table: mocks.tables.membershipRole })
    );
    expect(mocks.updates).toContainEqual(
      expect.objectContaining({
        table: mocks.tables.member,
        values: { role: "owner" },
      })
    );
    expect(mocks.updates).toContainEqual(
      expect.objectContaining({
        table: mocks.tables.member,
        values: { role: "admin" },
      })
    );
    expect(mocks.inserts).toContainEqual(
      expect.objectContaining({
        values: expect.objectContaining({
          action: "organization.ownership-transferred",
          metadata: expect.objectContaining({
            sourceMemberId: "actor-member",
            recipientMemberId: "recipient-member",
          }),
        }),
      })
    );
  });

  it("rejects globally disabled users as ownership recipients without writing assignments or audit", async () => {
    mocks.queryResults.push(
      [{ id: "org-a" }],
      grants,
      [{ id: "actor-member" }],
      [{ roleId: "role-owner" }],
      [{ id: "disabled-recipient", userId: "disabled-user", disabledAt: new Date() }],
      [{ id: "role-owner" }],
      [{ id: "role-admin" }]
    );

    await expect(
      manageOrganizationMember(actor, {
        kind: "transfer",
        recipientMemberId: "disabled-recipient",
      })
    ).rejects.toThrow("INVALID_TRANSFER_RECIPIENT");
    expect(mocks.inserts).toEqual([]);
    expect(mocks.updates).toEqual([]);
    expect(mocks.deletes).toEqual([]);
  });

  it("rejects self or suspended/non-member ownership recipients", async () => {
    mocks.queryResults.push(
      [{ id: "org-a" }],
      grants,
      [{ id: "actor-member" }],
      [{ roleId: "role-owner" }],
      []
    );
    await expect(
      manageOrganizationMember(actor, {
        kind: "transfer",
        recipientMemberId: "suspended-member",
      })
    ).rejects.toThrow("INVALID_TRANSFER_RECIPIENT");

    mocks.queryResults.push(
      [{ id: "org-a" }],
      grants,
      [{ id: "actor-member" }],
      [{ roleId: "role-owner" }],
      [{ id: "actor-member", userId: actor.userId }]
    );
    await expect(
      manageOrganizationMember(actor, {
        kind: "transfer",
        recipientMemberId: actor.membershipId,
      })
    ).rejects.toThrow("INVALID_TRANSFER_RECIPIENT");
  });

  it("lets an active member leave without the remove permission and deletes a final identity", async () => {
    mocks.queryResults.push(
      [{ id: "org-a" }],
      [
        {
          id: actor.membershipId,
          userId: actor.userId,
          status: "active",
          disabledAt: null,
          isOrganizationRestricted: false,
          managingOrganizationId: null,
          name: "Actor",
          email: "actor@example.com",
        },
      ],
      [{ membershipId: "another-owner" }],
      [{ membershipId: "another-owner" }],
      [{ total: 1 }]
    );

    const result = await manageOrganizationMember(actor, {
      kind: "remove",
      memberId: actor.membershipId,
    });

    expect(result).toMatchObject({ memberId: actor.membershipId, identityDeleted: true });
    expect(mocks.deletes.map(({ table }) => table)).toContain(mocks.tables.member);
    expect(mocks.deletes.map(({ table }) => table)).toContain(mocks.tables.user);
    expect(mocks.inserts).toContainEqual(
      expect.objectContaining({
        values: expect.objectContaining({
          action: "organization.member-removed",
          metadata: expect.objectContaining({
            actorSnapshot: expect.objectContaining({
              userId: actor.userId,
              email: actor.email,
              membershipId: actor.membershipId,
            }),
            targetSnapshot: expect.objectContaining({ userId: actor.userId }),
          }),
        }),
      })
    );
  });

  it.each([2, 1])(
    "audits self-leave before deleting its actor membership when %i memberships exist",
    async (membershipTotal) => {
      mocks.enforceImmediateAuditMembershipFk = true;
      mocks.queryResults.push(
        [{ id: "org-a" }],
        [
          {
            id: actor.membershipId,
            userId: actor.userId,
            status: "active",
            isOrganizationRestricted: false,
            managingOrganizationId: null,
            name: actor.name,
            email: actor.email,
            username: actor.username,
          },
        ],
        [{ membershipId: "another-owner" }],
        [{ membershipId: "another-owner" }],
        [{ total: membershipTotal }]
      );

      const result = await manageOrganizationMember(actor, {
        kind: "remove",
        memberId: actor.membershipId,
      });

      expect(result).toMatchObject({ identityDeleted: membershipTotal === 1 });
      expect(mocks.inserts).toContainEqual(
        expect.objectContaining({
          table: mocks.tables.authorizationAudit,
          values: expect.objectContaining({ actorMembershipId: actor.membershipId }),
        })
      );
    }
  );

  it("denies removing another member without the active-org remove permission", async () => {
    mocks.queryResults.push(
      [{ id: "org-a" }],
      [{ id: "target-member", userId: "target-user", status: "active" }],
      []
    );
    await expect(
      manageOrganizationMember(actor, { kind: "remove", memberId: "target-member" })
    ).rejects.toThrow("FORBIDDEN");
    expect(mocks.deletes).toEqual([]);
    expect(mocks.inserts).toEqual([]);
  });

  it("denies removing the last active administrator, counting legacy Owner", async () => {
    mocks.queryResults.push(
      [{ id: "org-a" }],
      [{ id: "target-member", userId: "target-user", status: "active" }],
      [{ key: "organization.members.remove" }],
      [{ membershipId: "target-member" }],
      [{ membershipId: "target-member" }]
    );
    await expect(
      manageOrganizationMember(actor, { kind: "remove", memberId: "target-member" })
    ).rejects.toThrow("LAST_ACTIVE_ADMIN");

    mocks.queryResults.push(
      [{ id: "org-a" }],
      [{ id: "target-member", userId: "target-user", status: "active" }],
      [{ key: "organization.members.remove" }],
      [{ membershipId: "another-owner" }],
      [{ membershipId: "target-member" }]
    );
    await expect(
      manageOrganizationMember(actor, { kind: "remove", memberId: "target-member" })
    ).rejects.toThrow("LAST_ACTIVE_ADMIN");
    expect(mocks.deletes).toEqual([]);
  });

  it("allows legacy Owner removal when another Admin remains, deduplicating aliases", async () => {
    mocks.queryResults.push(
      [{ id: "org-a" }],
      [{ id: "target-member", userId: "target-user", status: "active" }],
      [{ key: "organization.members.remove" }],
      [{ membershipId: "target-member" }, { membershipId: "admin-member" }],
      [{ membershipId: "target-member" }, { membershipId: "admin-member" }],
      [{ total: 2 }]
    );
    await expect(
      manageOrganizationMember(actor, { kind: "remove", memberId: "target-member" })
    ).resolves.toMatchObject({ identityDeleted: false });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "serializable",
    });
  });

  it("denies suspension when duplicate Admin/Owner aliases are the same last membership", async () => {
    mocks.queryResults.push(
      [{ id: "org-a" }],
      grants,
      [{ id: "target-member", userId: "target-user", status: "active", disabledAt: null }],
      [{ total: 2 }],
      [{ membershipId: "target-member" }, { membershipId: "target-member" }]
    );
    await expect(
      manageOrganizationMember(actor, {
        kind: "access",
        memberId: "target-member",
        status: "suspended",
      })
    ).rejects.toThrow("LAST_ACTIVE_ADMIN");
    expect(mocks.updates).toEqual([]);
  });

  it("preserves a restricted user's managing membership while another membership exists", async () => {
    mocks.queryResults.push(
      [{ id: "org-a" }],
      [
        {
          id: actor.membershipId,
          userId: actor.userId,
          status: "active",
          isOrganizationRestricted: true,
          managingOrganizationId: "org-a",
          name: "Actor",
          email: "actor@example.com",
        },
      ],
      [{ membershipId: "another-owner" }],
      [{ membershipId: "another-owner" }],
      [{ total: 2 }]
    );
    await expect(
      manageOrganizationMember(actor, { kind: "remove", memberId: actor.membershipId })
    ).rejects.toThrow("MANAGING_MEMBERSHIP_REQUIRED");
    expect(mocks.deletes).toEqual([]);
    expect(mocks.updates).toEqual([]);
  });

  it("removes a suspended allowed-org membership but preserves its grant and other memberships", async () => {
    mocks.queryResults.push(
      [{ id: "org-a" }],
      [
        {
          id: "target-member",
          userId: "restricted-user",
          status: "suspended",
          isOrganizationRestricted: true,
          managingOrganizationId: "org-manager",
          name: "Restricted User",
          email: "restricted@example.com",
        },
      ],
      [{ key: "organization.members.remove" }],
      [{ membershipId: "owner-member" }],
      [{ membershipId: "owner-member" }],
      [{ total: 2 }]
    );
    const result = await manageOrganizationMember(actor, {
      kind: "remove",
      memberId: "target-member",
    });
    expect(result).toMatchObject({ identityDeleted: false });
    expect(mocks.deletes).toContainEqual(expect.objectContaining({ table: mocks.tables.member }));
    expect(mocks.deletes).not.toContainEqual(expect.objectContaining({ table: mocks.tables.user }));
    expect(mocks.deletes).not.toContainEqual(
      expect.objectContaining({ table: mocks.tables.allowlistGrant })
    );
    expect(mocks.updates).toContainEqual(
      expect.objectContaining({
        table: mocks.tables.session,
        values: { activeOrganizationId: null },
        condition: {
          and: [
            { eq: ["session.userId", "restricted-user"] },
            { eq: ["session.activeOrganizationId", "org-a"] },
          ],
        },
      })
    );
  });

  it("simulates final-identity FK cascades for sessions, accounts, grants, and authored invitations", async () => {
    mocks.queryResults.push(
      [{ id: "org-a" }],
      [
        {
          id: actor.membershipId,
          userId: actor.userId,
          status: "active",
          isOrganizationRestricted: false,
          managingOrganizationId: null,
          name: "Actor",
          email: "actor@example.com",
        },
      ],
      [{ membershipId: "another-owner" }],
      [{ membershipId: "another-owner" }],
      [{ total: 1 }]
    );
    const result = await manageOrganizationMember(actor, {
      kind: "remove",
      memberId: actor.membershipId,
    });
    expect(result).toMatchObject({ identityDeleted: true });
    expect(mocks.deletes).toContainEqual(expect.objectContaining({ table: mocks.tables.user }));
    expect(mocks.simulatedCascades).toEqual([
      mocks.tables.session,
      mocks.tables.account,
      mocks.tables.allowlistGrant,
      mocks.tables.invitation,
    ]);
    expect(mocks.inserts).toContainEqual(
      expect.objectContaining({
        values: expect.objectContaining({
          metadata: expect.objectContaining({
            actorSnapshot: expect.objectContaining({ membershipId: actor.membershipId }),
            targetSnapshot: expect.objectContaining({ email: "actor@example.com" }),
            authoredInvitationsRevokedByCascade: true,
          }),
        }),
      })
    );
  });

  it.each(["membership", "user", "audit"] as const)(
    "rolls back removal when the %s delete/audit step fails",
    async (failingStep) => {
      mocks.queryResults.push(
        [{ id: "org-a" }],
        [
          {
            id: actor.membershipId,
            userId: actor.userId,
            status: "active",
            isOrganizationRestricted: false,
            managingOrganizationId: null,
            name: "Actor",
            email: "actor@example.com",
          },
        ],
        [{ membershipId: "another-owner" }],
        [{ membershipId: "another-owner" }],
        [{ total: 1 }]
      );
      if (failingStep === "membership") mocks.failDeleteTable = mocks.tables.member;
      if (failingStep === "user") mocks.failDeleteTable = mocks.tables.user;
      if (failingStep === "audit") mocks.failAudit = true;
      await expect(
        manageOrganizationMember(actor, { kind: "remove", memberId: actor.membershipId })
      ).rejects.toThrow(failingStep === "audit" ? "audit unavailable" : "delete unavailable");
      expect(mocks.deletes).toEqual([]);
      expect(mocks.inserts).toEqual([]);
      expect(mocks.simulatedCascades).toEqual([]);
    }
  );

  it("rolls back membership changes when the audit write fails", async () => {
    mocks.queryResults.push(
      [{ id: "org-a" }],
      grants,
      [{ id: "target-member", userId: "target-user", status: "active", disabledAt: null }],
      [{ total: 2 }],
      [{ membershipId: "another-owner" }]
    );
    mocks.failAudit = true;
    await expect(
      manageOrganizationMember(actor, {
        kind: "access",
        memberId: "target-member",
        status: "suspended",
      })
    ).rejects.toThrow("audit unavailable");
    expect(mocks.updates).toEqual([]);
    expect(mocks.deletes).toEqual([]);
    expect(mocks.inserts).toEqual([]);
  });
});
