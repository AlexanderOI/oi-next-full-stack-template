import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  queries: [] as Array<{ projection: unknown; where: unknown; limit: unknown; offset: unknown }>,
  rows: [] as unknown[][],
}));

vi.mock("server-only", () => ({}));
vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => ({ and: conditions }),
  asc: (column: unknown) => ({ asc: column }),
  desc: (column: unknown) => ({ desc: column }),
  count: () => "count",
  eq: (column: unknown, value: unknown) => ({ eq: [column, value] }),
  ilike: (column: unknown, value: unknown) => ({ ilike: [column, value] }),
  inArray: (column: unknown, values: unknown[]) => ({ inArray: [column, values] }),
  or: (...conditions: unknown[]) => ({ or: conditions }),
}));
vi.mock("@/features/authorization/server", () => ({
  PERMISSIONS: {
    ORGANIZATION_MEMBERS_READ: "organization.members.read",
    ORGANIZATION_MEMBERS_PROVISION: "organization.members.provision",
    ORGANIZATION_RESTRICTIONS_CREATE: "organization.restrictions.create",
    ORGANIZATION_MEMBERS_REMOVE: "organization.members.remove",
  },
}));
vi.mock("@/db/schema", () => ({
  member: {
    id: "member.id",
    organizationId: "member.organizationId",
    userId: "member.userId",
    status: "member.status",
    createdAt: "member.createdAt",
  },
  membershipRole: { membershipId: "membershipRole.membershipId", roleId: "membershipRole.roleId" },
  role: {
    id: "role.id",
    key: "role.key",
    name: "role.name",
    scope: "role.scope",
    isProtected: "role.isProtected",
    organizationId: "role.organizationId",
  },
  permission: { key: "permission.key", scope: "permission.scope" },
  rolePermission: {
    roleId: "rolePermission.roleId",
    permissionKey: "rolePermission.permissionKey",
  },
  user: {
    id: "user.id",
    name: "user.name",
    email: "user.email",
    username: "user.username",
    invitedAt: "user.invitedAt",
    emailVerified: "user.emailVerified",
    disabledAt: "user.disabledAt",
  },
}));
vi.mock("@/db/drizzle", () => ({
  db: {
    select: mocks.select.mockImplementation((projection: unknown) => {
      const query = {
        projection,
        where: undefined as unknown,
        limit: undefined as unknown,
        offset: undefined as unknown,
      };
      mocks.queries.push(query);
      const chain = {
        from: () => chain,
        innerJoin: () => chain,
        leftJoin: () => chain,
        where: (value: unknown) => {
          query.where = value;
          return chain;
        },
        orderBy: () => chain,
        limit: (value: unknown) => {
          query.limit = value;
          return chain;
        },
        offset: (value: unknown) => {
          query.offset = value;
          return chain;
        },
        then: (resolve: (value: unknown[]) => unknown) =>
          Promise.resolve(mocks.rows.shift() ?? []).then(resolve),
      };
      return chain;
    }),
  },
}));

import { listOrganizationMembers } from "@/features/organizations/lib/list-organization-members";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queries = [];
  mocks.rows = [
    [{ total: 1 }],
    [
      {
        id: "member-a",
        userId: "user-a",
        name: "Sam Example",
        email: "sam@example.com",
        username: "sam",
        status: "suspended",
        createdAt: new Date("2026-01-01"),
        invitedAt: null,
        emailVerified: true,
        disabledAt: null,
      },
    ],
    [{ membershipId: "member-a", roleId: "role-member", roleName: "Member" }],
  ];
});

describe("listOrganizationMembers", () => {
  it("scopes pagination to the tenant and keeps suspended rows", async () => {
    const result = await listOrganizationMembers({
      organizationId: "org-a",
      page: 2,
      pageSize: 20,
      search: "Sam",
      sort: "name",
      direction: "asc",
    });
    expect(result).toMatchObject({
      total: 1,
      page: 2,
      pageSize: 20,
      rows: [
        {
          id: "member-a",
          status: "suspended",
          activationState: "activated",
          roles: [{ id: "role-member", name: "Member" }],
        },
      ],
    });
    const expectedFilter = {
      and: [
        { eq: ["member.organizationId", "org-a"] },
        {
          or: [
            { ilike: ["user.name", "%Sam%"] },
            { ilike: ["user.email", "%Sam%"] },
            { ilike: ["user.username", "%Sam%"] },
          ],
        },
      ],
    };
    expect(mocks.queries[0]?.where).toEqual(expectedFilter);
    expect(mocks.queries[1]?.where).toEqual(expectedFilter);
    expect(mocks.queries[1]?.limit).toBe(20);
    expect(mocks.queries[1]?.offset).toBe(20);
    expect(mocks.queries[2]?.where).toEqual({
      and: [
        { inArray: ["membershipRole.membershipId", ["member-a"]] },
        { eq: ["role.scope", "organization"] },
        {
          or: [{ eq: ["role.isProtected", true] }, { eq: ["role.organizationId", "org-a"] }],
        },
      ],
    });
  });

  it("returns global disabled state only to access managers", async () => {
    mocks.rows = [
      [{ total: 1 }],
      [
        {
          id: "member-a",
          userId: "user-a",
          name: "Sam Example",
          email: "sam@example.com",
          username: "sam",
          status: "suspended",
          createdAt: new Date("2026-01-01"),
          invitedAt: null,
          disabledAt: new Date("2026-01-02"),
        },
      ],
      [],
    ];
    const hidden = await listOrganizationMembers({
      organizationId: "org-a",
      page: 1,
      pageSize: 20,
      search: "",
      sort: "name",
      direction: "asc",
    });
    expect(hidden.rows[0]).not.toHaveProperty("identityDisabled");

    mocks.rows = [
      [{ total: 1 }],
      [
        {
          id: "member-a",
          userId: "user-a",
          name: "Sam Example",
          email: "sam@example.com",
          username: "sam",
          status: "suspended",
          createdAt: new Date("2026-01-01"),
          invitedAt: null,
          disabledAt: new Date("2026-01-02"),
        },
      ],
      [],
    ];
    const visible = await listOrganizationMembers({
      organizationId: "org-a",
      page: 1,
      pageSize: 20,
      search: "",
      sort: "name",
      direction: "asc",
      includeIdentityDisabled: true,
    });
    expect(visible.rows[0]?.identityDisabled).toBe(true);
  });

  it("exposes remove permission separately for the member UI", async () => {
    mocks.rows = [[{ permissionKey: "organization.members.remove" }]];
    const { getOrganizationMemberPermissions } =
      await import("@/features/organizations/lib/list-organization-members");
    const permissions = await getOrganizationMemberPermissions("actor-user", "org-a");
    expect(permissions.canRemoveMembers).toBe(true);
    expect(permissions.canManageAccess).toBe(false);
  });

  it("clamps untrusted pagination and rejects unsupported sort columns", async () => {
    const result = await listOrganizationMembers({
      organizationId: "org-a",
      page: -5,
      pageSize: 500,
      search: "",
      sort: "unknown",
      direction: "desc",
    });
    expect(result).toMatchObject({ page: 1, pageSize: 100 });
    expect(mocks.queries[1]?.limit).toBe(100);
    expect(mocks.queries[1]?.offset).toBe(0);
  });
});
