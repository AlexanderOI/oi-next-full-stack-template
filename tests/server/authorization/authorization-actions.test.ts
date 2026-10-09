import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryResults: [] as unknown[][],
  revalidatePath: vi.fn(),
  requireAuthorizedSession: vi.fn(),
  transaction: vi.fn(),
  tables: {
    authorizationAudit: { table: "authorization-audit" },
    role: {
      table: "role",
      id: "role.id",
      key: "role.key",
      scope: "role.scope",
      isSystem: "role.isSystem",
    },
    rolePermission: {
      table: "role-permission",
      roleId: "role-permission.roleId",
      permissionKey: "role-permission.permissionKey",
    },
    user: { table: "user", id: "user.id" },
    platformRoleAssignment: {
      table: "platform-role-assignment",
      userId: "platform-role-assignment.userId",
      roleId: "platform-role-assignment.roleId",
      assignedByUserId: "platform-role-assignment.assignedByUserId",
    },
  },
  inserted: [] as Array<{ table: unknown; values: unknown }>,
  deleted: [] as unknown[],
  updated: [] as Array<{ table: unknown; values: unknown }>,
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions) => conditions),
  countDistinct: vi.fn((column) => ({ countDistinct: column })),
  eq: vi.fn((column, value) => ({ column, value, operator: "eq" })),
  inArray: vi.fn((column, values) => ({ column, values, operator: "in" })),
  ne: vi.fn((column, value) => ({ column, value, operator: "ne" })),
}));
vi.mock("@/db/schema", () => ({
  authorizationAudit: mocks.tables.authorizationAudit,
  permission: { key: "permission.key" },
  role: mocks.tables.role,
  rolePermission: mocks.tables.rolePermission,
  user: mocks.tables.user,
  platformRoleAssignment: mocks.tables.platformRoleAssignment,
}));
vi.mock("@/features/authorization/server", () => ({
  requireAuthorizedSession: mocks.requireAuthorizedSession,
}));
vi.mock("@/db/drizzle", () => ({ db: { transaction: mocks.transaction } }));

import { deleteRole, saveRole } from "@/features/authorization/actions/manage-roles";
import { replaceUserRoles } from "@/features/authorization/actions/manage-user-roles";
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
        mocks.inserted.push({ table, values });
      }),
    })),
    update: vi.fn((table) => ({
      set: vi.fn((values) => ({
        where: vi.fn(async () => {
          mocks.updated.push({ table, values });
        }),
      })),
    })),
    delete: vi.fn((table) => ({
      where: vi.fn(async () => {
        mocks.deleted.push(table);
      }),
    })),
  };
}

describe("authorization actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryResults.length = 0;
    mocks.inserted.length = 0;
    mocks.deleted.length = 0;
    mocks.updated.length = 0;
    mocks.requireAuthorizedSession.mockResolvedValue({ user: { id: "actor-1" } });
    mocks.transaction.mockImplementation(async (callback) => callback(transactionClient()));
  });

  describe("role management", () => {
    it("creates a role with a server-derived key, permissions, audit event, and revalidation", async () => {
      mocks.queryResults.push([]);

      const result = await saveRole({
        name: "Support Lead",
        description: "Leads support",
        permissions: [PERMISSIONS.ROLES_READ],
      });

      expect(result).toMatchObject({ success: true, data: { id: expect.any(String) } });
      expect(mocks.inserted).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            table: mocks.tables.role,
            values: expect.objectContaining({ key: "support.lead", name: "Support Lead" }),
          }),
          {
            table: mocks.tables.rolePermission,
            values: [
              {
                roleId: result.success ? result.data?.id : "",
                permissionKey: PERMISSIONS.ROLES_READ,
              },
            ],
          },
          expect.objectContaining({
            table: mocks.tables.authorizationAudit,
            values: expect.objectContaining({ action: "role.created", actorUserId: "actor-1" }),
          }),
        ])
      );
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/roles");
    });

    it("rejects a duplicate derived role key without persisting partial data", async () => {
      mocks.queryResults.push([{ id: "existing-role" }]);

      await expect(
        saveRole({
          name: "Support Lead",
          description: "Duplicate",
          permissions: [PERMISSIONS.ROLES_READ],
        })
      ).resolves.toEqual({ success: false, code: "ROLE_KEY_CONFLICT" });
      expect(mocks.inserted).toEqual([]);
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("updates a configurable role and replaces its permissions atomically", async () => {
      mocks.queryResults.push([{ isSystem: false }], []);

      await expect(
        saveRole({
          id: "role-1",
          name: "Operations Lead",
          description: "Runs operations",
          permissions: [PERMISSIONS.ROLES_UPDATE],
        })
      ).resolves.toEqual({ success: true, data: { id: "role-1" } });
      expect(mocks.updated).toEqual([
        expect.objectContaining({
          table: mocks.tables.role,
          values: expect.objectContaining({ key: "operations.lead" }),
        }),
      ]);
      expect(mocks.deleted).toContain(mocks.tables.rolePermission);
      expect(mocks.inserted).toContainEqual(
        expect.objectContaining({
          table: mocks.tables.authorizationAudit,
          values: expect.objectContaining({ action: "role.updated", targetId: "role-1" }),
        })
      );
    });

    it("protects system roles and assigned roles from destructive operations", async () => {
      mocks.queryResults.push([{ isSystem: true }]);
      await expect(
        saveRole({
          id: "admin",
          name: "Administrator",
          description: "System",
          permissions: [PERMISSIONS.ROLES_UPDATE],
        })
      ).resolves.toEqual({ success: false, code: "SYSTEM_ROLE_MODIFY" });

      mocks.queryResults.push([{ key: "support", isSystem: false }], [{ userId: "user-1" }]);
      await expect(deleteRole("role-1")).resolves.toEqual({
        success: false,
        code: "ROLE_ASSIGNED",
      });
      expect(mocks.deleted).toEqual([]);
    });

    it("deletes only an unassigned custom role and records the audit event", async () => {
      mocks.queryResults.push([{ key: "support", isSystem: false }], []);

      await expect(deleteRole("role-1")).resolves.toEqual({ success: true });
      expect(mocks.deleted).toEqual([mocks.tables.role]);
      expect(mocks.inserted).toContainEqual(
        expect.objectContaining({
          table: mocks.tables.authorizationAudit,
          values: expect.objectContaining({ action: "role.deleted", targetId: "role-1" }),
        })
      );
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/roles");
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/users");
    });
  });

  describe("user role assignment", () => {
    it("rejects organization-scoped legacy roles before replacing assignments", async () => {
      mocks.queryResults.push(
        [{ id: "target-1" }],
        [{ id: "organization-role", key: "organization.member", scope: "organization" }],
        [{ id: "admin" }],
        [],
        [{ value: 1 }],
        []
      );

      await expect(
        replaceUserRoles({ userId: "target-1", roleIds: ["organization-role"] })
      ).resolves.toEqual({ success: false, code: "INVALID_ROLES" });
      expect(mocks.deleted).toEqual([]);
      expect(mocks.inserted).toEqual([]);
    });

    it("prevents removal of the final administrator without replacing assignments", async () => {
      mocks.queryResults.push(
        [{ id: "target-1" }],
        [{ id: "member", key: "member", scope: "platform" }],
        [{ id: "admin" }],
        [{ userId: "target-1" }],
        [{ value: 1 }]
      );

      await expect(replaceUserRoles({ userId: "target-1", roleIds: ["member"] })).resolves.toEqual({
        success: false,
        code: "ADMINISTRATIVE_ACCESS",
      });
      expect(mocks.deleted).toEqual([]);
      expect(mocks.inserted).toEqual([]);
    });

    it("prevents an administrator from removing their own management capability", async () => {
      mocks.queryResults.push(
        [{ id: "actor-1" }],
        [{ id: "member", key: "member", scope: "platform" }],
        [{ id: "admin" }],
        [{ userId: "actor-1" }],
        [{ value: 2 }],
        []
      );

      await expect(replaceUserRoles({ userId: "actor-1", roleIds: ["member"] })).resolves.toEqual({
        success: false,
        code: "ADMINISTRATIVE_ACCESS",
      });
      expect(mocks.deleted).toEqual([]);
    });

    it("replaces valid assignments in a serializable transaction and records the outcome", async () => {
      mocks.queryResults.push(
        [{ id: "target-1" }],
        [
          { id: "admin", key: "admin", scope: "platform" },
          { id: "member", key: "member", scope: "platform" },
        ],
        [{ id: "admin" }],
        [],
        [{ value: 1 }]
      );

      await expect(
        replaceUserRoles({ userId: "target-1", roleIds: ["admin", "member"] })
      ).resolves.toEqual({ success: true });
      expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: "serializable",
      });
      expect(mocks.deleted).toEqual([mocks.tables.platformRoleAssignment]);
      expect(mocks.inserted).toContainEqual({
        table: mocks.tables.platformRoleAssignment,
        values: [
          { userId: "target-1", roleId: "admin", assignedByUserId: "actor-1" },
          { userId: "target-1", roleId: "member", assignedByUserId: "actor-1" },
        ],
      });
      expect(mocks.inserted).toContainEqual(
        expect.objectContaining({
          table: mocks.tables.authorizationAudit,
          values: expect.objectContaining({
            action: "user.roles-replaced",
            metadata: { roleIds: ["admin", "member"] },
          }),
        })
      );
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/users");
    });

    it("returns unauthorized before opening a transaction when the actor is signed out", async () => {
      mocks.requireAuthorizedSession.mockRejectedValue(new Error("Unauthorized"));

      await expect(replaceUserRoles({ userId: "target-1", roleIds: ["member"] })).resolves.toEqual({
        success: false,
        code: "UNAUTHORIZED",
      });
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("returns forbidden before opening a transaction when the actor lacks permission", async () => {
      mocks.requireAuthorizedSession.mockRejectedValue(new Error("FORBIDDEN"));

      await expect(replaceUserRoles({ userId: "target-1", roleIds: ["member"] })).resolves.toEqual({
        success: false,
        code: "FORBIDDEN",
      });
      expect(mocks.transaction).not.toHaveBeenCalled();
    });
  });
});
