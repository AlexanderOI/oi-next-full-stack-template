import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryResults: [] as unknown[][],
  revalidatePath: vi.fn(),
  requireAuthorizedSession: vi.fn(),
  transaction: vi.fn(),
  failAuditInsert: false,
  tables: {
    authorizationAudit: { table: "authorization-audit" },
    permission: { table: "permission", key: "permission.key" },
    role: { table: "role", id: "role.id" },
    rolePermission: {
      table: "role-permission",
      roleId: "role-permission.roleId",
      permissionKey: "role-permission.permissionKey",
    },
    session: { table: "session", userId: "session.userId" },
    user: {
      table: "user",
      id: "user.id",
      disabledAt: "user.disabledAt",
      invitedAt: "user.invitedAt",
    },
    userRole: { table: "user-role", userId: "user-role.userId", roleId: "user-role.roleId" },
  },
  inserted: [] as Array<{ table: unknown; values: unknown }>,
  deleted: [] as Array<{ table: unknown; condition: unknown }>,
  updated: [] as Array<{ table: unknown; values: unknown; condition: unknown }>,
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions) => ({ and: conditions })),
  eq: vi.fn((column, value) => ({ column, value, operator: "eq" })),
  inArray: vi.fn((column, values) => ({ column, values, operator: "in" })),
  isNull: vi.fn((column) => ({ column, operator: "is-null" })),
}));
vi.mock("@/db/schema", () => mocks.tables);
vi.mock("@/features/authorization/server", () => ({
  requireAuthorizedSession: mocks.requireAuthorizedSession,
}));
vi.mock("@/db/drizzle", () => ({ db: { transaction: mocks.transaction } }));

import { updateUserAccess } from "@/features/authorization/actions/manage-user-access";
import { PERMISSIONS } from "@/features/authorization/constants/permissions";

function query(result: unknown[]) {
  const chain = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(async () => result),
    then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  chain.from.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

function transactionClient() {
  return {
    select: vi.fn(() => query(mocks.queryResults.shift() ?? [])),
    insert: vi.fn((table) => ({
      values: vi.fn(async (values) => {
        if (table === mocks.tables.authorizationAudit && mocks.failAuditInsert) {
          throw new Error("audit unavailable");
        }
        mocks.inserted.push({ table, values });
      }),
    })),
    update: vi.fn((table) => ({
      set: vi.fn((values) => ({
        where: vi.fn(async (condition) => {
          mocks.updated.push({ table, values, condition });
        }),
      })),
    })),
    delete: vi.fn((table) => ({
      where: vi.fn(async (condition) => {
        mocks.deleted.push({ table, condition });
      }),
    })),
  };
}

describe("user access action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryResults.length = 0;
    mocks.inserted.length = 0;
    mocks.deleted.length = 0;
    mocks.updated.length = 0;
    mocks.failAuditInsert = false;
    mocks.requireAuthorizedSession.mockResolvedValue({ user: { id: "actor-1" } });
    mocks.transaction.mockImplementation(async (callback) => {
      const snapshots = {
        inserted: mocks.inserted.length,
        deleted: mocks.deleted.length,
        updated: mocks.updated.length,
      };
      try {
        return await callback(transactionClient());
      } catch (error) {
        mocks.inserted.length = snapshots.inserted;
        mocks.deleted.length = snapshots.deleted;
        mocks.updated.length = snapshots.updated;
        throw error;
      }
    });
  });

  it("requires access-update permission before validating or looking up malformed and unknown targets", async () => {
    mocks.requireAuthorizedSession.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(updateUserAccess({ userId: "", status: "disabled" })).resolves.toEqual({
      success: false,
      code: "FORBIDDEN",
    });
    await expect(updateUserAccess({ userId: "unknown-user", status: "disabled" })).resolves.toEqual(
      { success: false, code: "FORBIDDEN" }
    );

    expect(mocks.requireAuthorizedSession).toHaveBeenNthCalledWith(
      1,
      PERMISSIONS.USER_ACCESS_UPDATE
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("maps an unauthenticated session to an explicit serializable result", async () => {
    mocks.requireAuthorizedSession.mockRejectedValue(new Error("Unauthorized"));

    await expect(updateUserAccess({ userId: "user-2", status: "disabled" })).resolves.toEqual({
      success: false,
      code: "UNAUTHORIZED",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns validation failure only after authorization succeeds", async () => {
    await expect(updateUserAccess({ userId: "", status: "disabled" })).resolves.toEqual({
      success: false,
      code: "VALIDATION_ERROR",
    });
    expect(mocks.requireAuthorizedSession).toHaveBeenCalledWith(PERMISSIONS.USER_ACCESS_UPDATE);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("forbids disabling the actor's own account", async () => {
    mocks.queryResults.push([{ id: "actor-1", disabledAt: null, invitedAt: null }]);

    await expect(updateUserAccess({ userId: "actor-1", status: "disabled" })).resolves.toEqual({
      success: false,
      code: "SELF_DISABLE_FORBIDDEN",
    });
    expect(mocks.updated).toEqual([]);
    expect(mocks.deleted).toEqual([]);
  });

  it("protects the last active user for each effective management capability", async () => {
    mocks.queryResults.push(
      [{ id: "manager-1", disabledAt: null, invitedAt: null }],
      [
        { userId: "actor-1", permissionKey: PERMISSIONS.USER_ACCESS_UPDATE },
        { userId: "manager-1", permissionKey: PERMISSIONS.USER_ROLES_UPDATE },
      ]
    );

    await expect(updateUserAccess({ userId: "manager-1", status: "disabled" })).resolves.toEqual({
      success: false,
      code: "LAST_ACTIVE_MANAGER",
    });
    expect(mocks.updated).toEqual([]);
    expect(mocks.deleted).toEqual([]);
  });

  it("atomically disables access, deletes every target session, and audits safe metadata", async () => {
    mocks.queryResults.push(
      [{ id: "user-2", disabledAt: null, invitedAt: null }],
      [{ userId: "actor-1", permissionKey: PERMISSIONS.USER_ACCESS_UPDATE }]
    );

    await expect(updateUserAccess({ userId: "user-2", status: "disabled" })).resolves.toEqual({
      success: true,
      data: { userId: "user-2", status: "disabled", changed: true },
    });

    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "serializable",
    });
    expect(mocks.updated).toEqual([
      expect.objectContaining({
        table: mocks.tables.user,
        values: { disabledAt: expect.any(Date) },
      }),
    ]);
    expect(mocks.deleted).toEqual([expect.objectContaining({ table: mocks.tables.session })]);
    expect(mocks.inserted).toEqual([
      expect.objectContaining({
        table: mocks.tables.authorizationAudit,
        values: expect.objectContaining({
          actorUserId: "actor-1",
          action: "user.access-disabled",
          targetId: "user-2",
          metadata: { status: "disabled" },
        }),
      }),
    ]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/users");
  });

  it("rolls back the state and session revocation when auditing fails", async () => {
    mocks.queryResults.push(
      [{ id: "user-2", disabledAt: null, invitedAt: null }],
      [{ userId: "actor-1", permissionKey: PERMISSIONS.USER_ACCESS_UPDATE }]
    );
    mocks.failAuditInsert = true;

    await expect(updateUserAccess({ userId: "user-2", status: "disabled" })).resolves.toEqual({
      success: false,
      code: "ACCESS_UPDATE_FAILED",
    });
    expect(mocks.updated).toEqual([]);
    expect(mocks.deleted).toEqual([]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("handles pending, missing, and already-disabled targets without false mutations", async () => {
    mocks.queryResults.push([{ id: "pending-1", disabledAt: null, invitedAt: new Date() }]);
    await expect(updateUserAccess({ userId: "pending-1", status: "disabled" })).resolves.toEqual({
      success: false,
      code: "INVITATION_PENDING",
    });

    mocks.queryResults.push([]);
    await expect(updateUserAccess({ userId: "missing-1", status: "disabled" })).resolves.toEqual({
      success: false,
      code: "USER_NOT_FOUND",
    });

    mocks.queryResults.push([{ id: "user-2", disabledAt: new Date(), invitedAt: null }]);
    await expect(updateUserAccess({ userId: "user-2", status: "disabled" })).resolves.toEqual({
      success: true,
      data: { userId: "user-2", status: "disabled", changed: false },
    });

    expect(mocks.updated).toEqual([]);
    expect(mocks.deleted).toEqual([]);
    expect(mocks.inserted).toEqual([]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("reactivates a disabled account without creating a session", async () => {
    mocks.queryResults.push([{ id: "user-2", disabledAt: new Date(), invitedAt: null }]);

    await expect(updateUserAccess({ userId: "user-2", status: "active" })).resolves.toEqual({
      success: true,
      data: { userId: "user-2", status: "active", changed: true },
    });
    expect(mocks.updated).toEqual([
      expect.objectContaining({ table: mocks.tables.user, values: { disabledAt: null } }),
    ]);
    expect(mocks.deleted).toEqual([]);
    expect(mocks.inserted).toEqual([
      expect.objectContaining({
        table: mocks.tables.authorizationAudit,
        values: expect.objectContaining({
          action: "user.access-reactivated",
          metadata: { status: "active" },
        }),
      }),
    ]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/users");
  });

  it("reports an already-active reactivation without writing or revalidating", async () => {
    mocks.queryResults.push([{ id: "user-2", disabledAt: null, invitedAt: null }]);

    await expect(updateUserAccess({ userId: "user-2", status: "active" })).resolves.toEqual({
      success: true,
      data: { userId: "user-2", status: "active", changed: false },
    });
    expect(mocks.updated).toEqual([]);
    expect(mocks.deleted).toEqual([]);
    expect(mocks.inserted).toEqual([]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
