import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  tables: {} as Record<string, string>,
}));

vi.mock("server-only", () => ({}));
vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => ({ operator: "and", conditions }),
  asc: (column: unknown) => ({ operator: "asc", column }),
  count: () => "count",
  desc: (column: unknown) => ({ operator: "desc", column }),
  eq: (column: unknown, value: unknown) => ({ operator: "eq", column, value }),
  gt: (column: unknown, value: unknown) => ({ operator: "gt", column, value }),
  ilike: (column: unknown, value: unknown) => ({ operator: "ilike", column, value }),
  isNull: (column: unknown) => ({ operator: "isNull", column }),
  lte: (column: unknown, value: unknown) => ({ operator: "lte", column, value }),
  or: (...conditions: unknown[]) => ({ operator: "or", conditions }),
}));
vi.mock("@/db/drizzle", () => ({ db: { select: mocks.select } }));
vi.mock("@/features/authorization/server", () => ({
  PERMISSIONS: {
    ORGANIZATION_INVITATIONS_READ: "organization.invitations.read",
    ORGANIZATION_INVITATIONS_CREATE: "organization.invitations.create",
    ORGANIZATION_MEMBER_ROLES_UPDATE: "organization.member-roles.update",
    ORGANIZATION_INVITATIONS_RESEND: "organization.invitations.resend",
    ORGANIZATION_INVITATIONS_CANCEL: "organization.invitations.cancel",
    ORGANIZATION_OWNERSHIP_TRANSFER: "organization.ownership.transfer",
  },
}));
vi.mock("@/db/schema", () => ({
  invitation: {
    id: "invitation.id",
    organizationId: "invitation.organizationId",
    email: "invitation.email",
    role: "invitation.role",
    status: "invitation.status",
    expiresAt: "invitation.expiresAt",
    createdAt: "invitation.createdAt",
  },
  organization: { id: "organization.id" },
  member: {
    id: "member.id",
    userId: "member.userId",
    organizationId: "member.organizationId",
    status: "member.status",
  },
  membershipRole: { membershipId: "membershipRole.membershipId", roleId: "membershipRole.roleId" },
  permission: { key: "permission.key", scope: "permission.scope" },
  rolePermission: {
    roleId: "rolePermission.roleId",
    permissionKey: "rolePermission.permissionKey",
  },
  role: {
    id: "role.id",
    key: "role.key",
    name: "role.name",
    scope: "role.scope",
    organizationId: "role.organizationId",
    isProtected: "role.isProtected",
  },
}));

import {
  getOrganizationInvitationPermissions,
  listOrganizationInvitations,
} from "@/features/organizations/lib/list-organization-invitations";

function query(result: unknown) {
  const builder = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

describe("listOrganizationInvitations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns tenant rows with effective expiry and role-ID options without changing stored status", async () => {
    const expired = new Date("2030-01-01T00:00:00.000Z");
    const future = new Date("2030-01-03T00:00:00.000Z");
    const countQuery = query([{ total: 2 }]);
    const rowsQuery = query([
      {
        id: "capability-secret",
        email: "expired@example.com",
        roleId: "role-custom",
        status: "pending",
        expiresAt: expired,
        createdAt: new Date("2029-12-01T00:00:00.000Z"),
        roleName: "Analyst",
      },
      {
        id: "other-capability",
        email: "active@example.com",
        roleId: "role-owner",
        status: "pending",
        expiresAt: future,
        createdAt: new Date("2029-12-02T00:00:00.000Z"),
        roleName: "Owner",
      },
    ]);
    const rolesQuery = query([
      { id: "role-owner", key: "owner", name: "Owner", isProtected: true },
      { id: "role-member", key: "member", name: "Member", isProtected: true },
      { id: "role-custom", key: "analyst", name: "Analyst", isProtected: false },
    ]);
    mocks.select
      .mockReturnValueOnce(countQuery)
      .mockReturnValueOnce(rowsQuery)
      .mockReturnValueOnce(rolesQuery);

    const result = await listOrganizationInvitations({
      organizationId: "tenant-a",
      page: 1,
      pageSize: 20,
      search: "",
      status: "all",
      sort: "createdAt",
      direction: "asc",
      now: new Date("2030-01-02T00:00:00.000Z"),
    });

    expect(result).toMatchObject({
      total: 2,
      page: 1,
      pageSize: 20,
      rows: [
        {
          email: "expired@example.com",
          roleId: "role-custom",
          roleName: "Analyst",
          status: "pending",
          effectiveStatus: "expired",
          expiresAt: expired,
          createdAt: expect.any(Date),
        },
        {
          email: "active@example.com",
          roleId: "role-owner",
          roleName: "Owner",
          status: "pending",
          effectiveStatus: "pending",
          expiresAt: future,
          createdAt: expect.any(Date),
        },
      ],
      roles: [
        { id: "role-owner", key: "owner", name: "Owner", isProtected: true },
        { id: "role-member", key: "member", name: "Member", isProtected: true },
        { id: "role-custom", key: "analyst", name: "Analyst", isProtected: false },
      ],
    });
    expect(result.rows[0].id).toBe("capability-secret");
    expect(rowsQuery.limit).toHaveBeenCalledWith(20);
    expect(rowsQuery.offset).toHaveBeenCalledWith(0);
    expect(rowsQuery.where).toHaveBeenCalledWith(
      expect.objectContaining({
        conditions: expect.arrayContaining([
          { operator: "eq", column: "invitation.organizationId", value: "tenant-a" },
        ]),
      })
    );
    expect(rowsQuery.orderBy).toHaveBeenCalledWith(
      { operator: "asc", column: "invitation.createdAt" },
      { operator: "asc", column: "invitation.id" }
    );
  });

  it("bounds page size and ignores unallowlisted sorting", async () => {
    const countQuery = query([{ total: 0 }]);
    const rowsQuery = query([]);
    const rolesQuery = query([]);
    mocks.select
      .mockReturnValueOnce(countQuery)
      .mockReturnValueOnce(rowsQuery)
      .mockReturnValueOnce(rolesQuery);

    await listOrganizationInvitations({
      organizationId: "tenant-a",
      page: -1,
      pageSize: 500,
      search: "",
      status: "invalid",
      sort: "id;drop",
      direction: "desc",
    });

    expect(rowsQuery.limit).toHaveBeenCalledWith(100);
    expect(rowsQuery.offset).toHaveBeenCalledWith(0);
    expect(rowsQuery.orderBy).toHaveBeenCalledWith(
      { operator: "desc", column: "invitation.createdAt" },
      { operator: "asc", column: "invitation.id" }
    );
  });

  it("requires member-role update alongside create and resend permissions", async () => {
    const permissionsQuery = query(
      [
        "organization.invitations.read",
        "organization.invitations.create",
        "organization.invitations.resend",
        "organization.invitations.cancel",
        "organization.ownership.transfer",
      ].map((permissionKey) => ({ permissionKey }))
    );
    mocks.select.mockReturnValueOnce(permissionsQuery);

    await expect(getOrganizationInvitationPermissions("user-a", "tenant-a")).resolves.toEqual({
      canRead: true,
      canCreate: false,
      canResend: false,
      canCancel: true,
      canUpdateMemberRoles: false,
      canTransferOwnership: true,
    });

    mocks.select.mockReturnValueOnce(
      query(
        [
          "organization.invitations.create",
          "organization.member-roles.update",
          "organization.invitations.resend",
        ].map((permissionKey) => ({ permissionKey }))
      )
    );
    await expect(getOrganizationInvitationPermissions("user-a", "tenant-a")).resolves.toMatchObject(
      {
        canCreate: true,
        canResend: true,
      }
    );
  });
});
