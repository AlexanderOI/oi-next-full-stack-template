import { describe, expect, it, vi } from "vitest";

const fakeDb = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/db/drizzle", () => ({ db: fakeDb }));

import { authorizationAudit, invitation, organization, user } from "@/db/schema";
import { rejectOrganizationInvitation } from "@/features/organizations/lib/respond-to-organization-invitation";

function install(
  email: string,
  verified = false,
  status = "pending",
  options: { disabledAt?: Date | null; transition?: boolean; failAudit?: boolean } = {}
) {
  const state = {
    invitation: {
      id: "token-id",
      organizationId: "org-1",
      email: "r@example.com",
      status,
      expiresAt: new Date("2032-04-07T00:00:00Z"),
    },
    audit: [] as Record<string, unknown>[],
    updated: false,
  };
  const tx = {
    select: () => {
      let table: unknown;
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
          return query;
        },
        then(resolve: (rows: unknown[]) => unknown) {
          const rows =
            table === invitation
              ? [state.invitation]
              : table === user
                ? [
                    {
                      id: "user-1",
                      email,
                      disabledAt: options.disabledAt ?? null,
                      emailVerified: verified,
                    },
                  ]
                : table === organization
                  ? [{ slug: "acme", name: "Acme" }]
                  : [];
          return Promise.resolve(rows).then(resolve);
        },
      };
      return query;
    },
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            if (state.invitation.status !== "pending" || options.transition === false) return [];
            Object.assign(state.invitation, values);
            state.updated = true;
            return [{ id: state.invitation.id }];
          },
        }),
      }),
    }),
    insert: (table: unknown) => ({
      values: async (value: Record<string, unknown>) => {
        if (table === authorizationAudit) {
          state.audit.push(value);
          if (options.failAudit) throw new Error("audit insert failed");
        }
      },
    }),
  };
  fakeDb.transaction.mockImplementation(async (callback) => {
    const snapshot = structuredClone({
      invitation: state.invitation,
      audit: state.audit,
      updated: state.updated,
    });
    try {
      return await callback(tx);
    } catch (error) {
      Object.assign(state, snapshot);
      throw error;
    }
  });
  return state;
}

describe("organization invitation rejection service", () => {
  it("rejects a matching pending unexpired invitation without requiring verified email or target membership", async () => {
    const state = install("r@example.com", false);
    await expect(rejectOrganizationInvitation("token-id", "user-1")).resolves.toEqual({
      changed: true,
      invitationId: "token-id",
    });
    expect(state.invitation.status).toBe("rejected");
    expect(state.audit).toHaveLength(1);
    expect(state.audit[0]).toMatchObject({ actorUserId: "user-1", actorMembershipId: null });
  });

  it.each([
    ["accepted", "INVITATION_NOT_PENDING"],
    ["pending", "INVITATION_EXPIRED"],
  ] as const)("rejects a non-rejectable state (%s)", async (status, expected) => {
    const state = install("r@example.com", false, status);
    if (status === "pending") state.invitation.expiresAt = new Date("2000-01-01T00:00:00Z");
    await expect(rejectOrganizationInvitation("token-id", "user-1")).rejects.toThrow(expected);
    expect(state.audit).toHaveLength(0);
  });

  it("rolls back rejection when the conditional update returns zero rows", async () => {
    const state = install("r@example.com", false, "pending", { transition: false });
    await expect(rejectOrganizationInvitation("token-id", "user-1")).rejects.toThrow(
      "INVITATION_TRANSITION_CONFLICT"
    );
    expect(state.invitation.status).toBe("pending");
    expect(state.updated).toBe(false);
    expect(state.audit).toHaveLength(0);
  });

  it("rolls back the rejected status when audit insertion fails", async () => {
    const state = install("r@example.com", false, "pending", { failAudit: true });
    await expect(rejectOrganizationInvitation("token-id", "user-1")).rejects.toThrow(
      "audit insert failed"
    );
    expect(state.invitation.status).toBe("pending");
    expect(state.updated).toBe(false);
    expect(state.audit).toHaveLength(0);
  });

  it("refuses a disabled recipient without mutating or auditing", async () => {
    const state = install("r@example.com", false, "pending", { disabledAt: new Date() });
    await expect(rejectOrganizationInvitation("token-id", "user-1")).rejects.toThrow(
      "UNAUTHORIZED"
    );
    expect(state.invitation.status).toBe("pending");
    expect(state.updated).toBe(false);
    expect(state.audit).toHaveLength(0);
  });

  it("refuses a different recipient without changing or auditing the invitation", async () => {
    const state = install("other@example.com");
    await expect(rejectOrganizationInvitation("token-id", "user-1")).rejects.toThrow(
      "INVITATION_RECIPIENT_MISMATCH"
    );
    expect(state.updated).toBe(false);
    expect(state.audit).toHaveLength(0);
  });
});
