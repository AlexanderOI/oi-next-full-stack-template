import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  selectRows: [] as unknown[][],
  writes: [] as Array<{ kind: string; table: unknown; values?: unknown; where?: unknown }>,
  transaction: vi.fn(),
  transactionFailure: undefined as string | undefined,
  sessionCleanupFailure: false,
  simulatedCascades: [] as unknown[],
  auditRecord: undefined as Record<string, unknown> | undefined,
  tables: {
    account: { userId: "account.userId" },
    allowlistGrant: {
      subjectUserId: "grant.subjectUserId",
      grantingOrganizationId: "grant.managerId",
    },
    authorizationAudit: { table: "audit" },
    invitation: { organizationId: "invitation.organizationId" },
    member: {
      id: "member.id",
      organizationId: "member.organizationId",
      userId: "member.userId",
      status: "member.status",
    },
    membershipRole: { membershipId: "membershipRole.membershipId" },
    organization: { id: "organization.id", slug: "organization.slug", name: "organization.name" },
    permission: { key: "permission.key" },
    role: {
      id: "role.id",
      key: "role.key",
      isProtected: "role.isProtected",
      scope: "role.scope",
      organizationId: "role.organizationId",
    },
    rolePermission: {
      roleId: "rolePermission.roleId",
      permissionKey: "rolePermission.permissionKey",
    },
    session: { userId: "session.userId", activeOrganizationId: "session.activeOrganizationId" },
    user: { id: "user.id", managingOrganizationId: "user.managingOrganizationId" },
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("drizzle-orm", () => ({
  and: (...values: unknown[]) => ({ and: values }),
  eq: (column: unknown, value: unknown) => ({ eq: [column, value] }),
  inArray: (column: unknown, values: unknown[]) => ({ inArray: [column, values] }),
  isNull: (column: unknown) => ({ isNull: column }),
  or: (...values: unknown[]) => ({ or: values }),
}));
vi.mock("@/db/schema", () => mocks.tables);
vi.mock("@/features/authorization/server", () => ({
  PERMISSIONS: { ORGANIZATION_DELETE: "organization.delete" },
}));
vi.mock("@/db/drizzle", () => ({
  db: {
    transaction: mocks.transaction,
    update: (table: unknown) => ({
      set: (values: unknown) => ({
        where: async (where: unknown) => {
          mocks.writes.push({ kind: "post-commit-update", table, values, where });
          if (mocks.sessionCleanupFailure) throw new Error("session cleanup unavailable");
        },
      }),
    }),
  },
}));

import {
  clearDeletedOrganizationSessionContext,
  deleteOrganization,
} from "../../../src/features/organizations/lib/delete-organization";

const owner = {
  userId: "owner-user",
  membershipId: "owner-member",
  organizationId: "org-a",
  organizationSlug: "acme",
  organizationName: "Acme",
};

function query(rows: unknown[]) {
  const resolvedRows = rows.map((row) => {
    if (typeof row !== "object" || row === null || !("roleKey" in row)) return row;
    const roleRow = row as { roleKey: string; isProtected?: boolean };
    return { ...roleRow, isProtected: roleRow.isProtected ?? roleRow.roleKey === "owner" };
  });
  const chain = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    for: vi.fn(),
    limit: vi.fn(),
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(resolvedRows).then(resolve),
  };
  for (const method of ["from", "innerJoin", "leftJoin", "where", "for"]) {
    chain[method as "from"].mockReturnValue(chain);
  }
  chain.limit.mockResolvedValue(resolvedRows);
  return chain;
}

function client() {
  return {
    select: vi.fn(() => query(mocks.selectRows.shift() ?? [])),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((values: unknown) => ({
        where: vi.fn(async (where: unknown) => {
          mocks.writes.push({ kind: "update", table, values, where });
          if (table === mocks.tables.user && mocks.transactionFailure === "freeze")
            throw new Error("injected");
        }),
      })),
    })),
    delete: vi.fn((table: unknown) => ({
      where: vi.fn(async (where: unknown) => {
        mocks.writes.push({ kind: "delete", table, where });
        if (table === mocks.tables.user) {
          mocks.simulatedCascades.push(
            "sessions",
            "accounts",
            "identity-grants",
            "authored-invitations"
          );
          if (mocks.auditRecord) mocks.auditRecord.actorUserId = null;
        }
        if (table === mocks.tables.organization) {
          mocks.simulatedCascades.push(
            "memberships",
            "roles",
            "invitations",
            "organization-grants"
          );
          if (mocks.auditRecord) {
            mocks.auditRecord.organizationId = null;
            mocks.auditRecord.actorMembershipId = null;
          }
        }
        if (
          table === mocks.tables.organization &&
          mocks.transactionFailure === "organization-delete"
        )
          throw new Error("injected");
      }),
    })),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn(async (values: unknown) => {
        mocks.writes.push({ kind: "insert", table, values });
        if (table === mocks.tables.authorizationAudit)
          mocks.auditRecord = values as Record<string, unknown>;
        if (mocks.transactionFailure === "audit" && table === mocks.tables.authorizationAudit)
          throw new Error("injected");
      }),
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.selectRows = [];
  mocks.writes = [];
  mocks.transactionFailure = undefined;
  mocks.sessionCleanupFailure = false;
  mocks.simulatedCascades = [];
  mocks.auditRecord = undefined;
  mocks.transaction.mockImplementation(async (callback) => {
    const writeLength = mocks.writes.length;
    const cascadeLength = mocks.simulatedCascades.length;
    const auditBefore = mocks.auditRecord ? structuredClone(mocks.auditRecord) : undefined;
    try {
      return await callback(client());
    } catch (error) {
      mocks.writes.length = writeLength;
      mocks.simulatedCascades.length = cascadeLength;
      mocks.auditRecord = auditBefore;
      throw error;
    }
  });
});

describe("organization deletion policy", () => {
  it("denies non-owners and actors without organization.delete without writes", async () => {
    mocks.selectRows = [
      [{ id: "org-a", slug: "acme", name: "Acme" }],
      [
        {
          membershipId: "owner-member",
          userId: "owner-user",
          status: "active",
          roleKey: "admin",
          isProtected: false,
          permissionKey: "organization.delete",
        },
      ],
    ];
    await expect(deleteOrganization(owner, "acme")).rejects.toThrow("FORBIDDEN");
    expect(mocks.writes).toEqual([]);

    mocks.selectRows = [
      [{ id: "org-a", slug: "acme", name: "Acme" }],
      [
        {
          membershipId: "owner-member",
          userId: "owner-user",
          status: "active",
          roleKey: "owner",
          isProtected: true,
          permissionKey: "organization.update",
        },
      ],
    ];
    await expect(deleteOrganization(owner, "acme")).rejects.toThrow("FORBIDDEN");
    expect(mocks.writes).toEqual([]);

    mocks.selectRows = [
      [{ id: "org-a", slug: "acme", name: "Acme" }],
      [
        {
          membershipId: "owner-member",
          userId: "owner-user",
          status: "active",
          roleKey: "owner",
          isProtected: false,
          permissionKey: "organization.delete",
        },
      ],
    ];
    await expect(deleteOrganization(owner, "acme")).rejects.toThrow("FORBIDDEN");
    expect(mocks.writes).toEqual([]);
  });

  it("rejects a non-canonical confirmation before writes", async () => {
    mocks.selectRows = [[{ id: "org-a", slug: "acme", name: "Acme" }]];
    await expect(deleteOrganization(owner, "ACME ")).rejects.toThrow("CONFIRMATION_MISMATCH");
    expect(mocks.writes).toEqual([]);
  });

  it("preserves an unrestricted identity and other memberships, then clears its active-org session after commit", async () => {
    mocks.selectRows = [
      [{ id: "org-a", slug: "acme", name: "Acme" }],
      [{ roleKey: "owner", permissionKey: "organization.delete" }],
      [
        {
          membershipId: "owner-member",
          userId: "owner-user",
          status: "active",
          name: "Owner",
          email: "owner@example.com",
          username: "owner",
          isOrganizationRestricted: false,
          managingOrganizationId: null,
        },
      ],
      [
        { id: "owner-member", userId: "owner-user", organizationId: "org-a", status: "active" },
        { id: "member-b", userId: "owner-user", organizationId: "org-b", status: "suspended" },
      ],
      [],
    ];
    const result = await deleteOrganization(owner, "acme");
    expect(result).toMatchObject({
      deletedUserIds: [],
      survivingUserIds: ["owner-user"],
      sessionCleanupPending: false,
    });
    expect(
      mocks.writes.some(({ kind, table }) => kind === "delete" && table === mocks.tables.user)
    ).toBe(false);
    expect(
      mocks.writes.some(
        ({ kind, table }) => kind === "post-commit-update" && table === mocks.tables.session
      )
    ).toBe(true);
  });

  it("freezes a restricted orphan and retains manager snapshots and surviving allowed grants", async () => {
    const restricted = {
      membershipId: "restricted-member",
      userId: "restricted-user",
      status: "active",
      name: "Restricted",
      email: "r@example.com",
      username: "restricted",
      isOrganizationRestricted: true,
      managingOrganizationId: "org-a",
      managingOrganizationIdSnapshot: "org-a",
      managingOrganizationSlugSnapshot: "acme",
      managingOrganizationNameSnapshot: "Acme",
      allowlistFrozenAt: null,
    };
    const grant = {
      id: "grant-b",
      subjectUserId: "restricted-user",
      grantingOrganizationId: "org-a",
      grantingOrganizationIdSnapshot: "org-a",
      grantingOrganizationSlugSnapshot: "acme",
      grantingOrganizationNameSnapshot: "Acme",
      allowedOrganizationId: "org-b",
      grantedByUserIdSnapshot: "owner-user",
    };
    mocks.selectRows = [
      [{ id: "org-a", slug: "acme", name: "Acme" }],
      [{ roleKey: "owner", permissionKey: "organization.delete" }],
      [restricted],
      [
        {
          id: "restricted-member",
          userId: "restricted-user",
          organizationId: "org-a",
          status: "active",
        },
        {
          id: "restricted-b",
          userId: "restricted-user",
          organizationId: "org-b",
          status: "suspended",
        },
      ],
      [grant],
    ];
    await deleteOrganization(owner, "acme");
    const freeze = mocks.writes.find(
      ({ kind, table }) => kind === "update" && table === mocks.tables.user
    );
    expect(freeze?.values).toMatchObject({
      managingOrganizationId: null,
      allowlistFrozenAt: expect.any(Date),
    });
    const audit = mocks.writes.find(
      ({ kind, table }) => kind === "insert" && table === mocks.tables.authorizationAudit
    )?.values as {
      metadata: {
        affectedUsers: Array<{ grants: unknown[]; managingOrganizationSlugSnapshot: string }>;
      };
    };
    expect(audit.metadata.affectedUsers[0]).toMatchObject({
      managingOrganizationSlugSnapshot: "acme",
      grants: [grant],
    });
    expect(
      mocks.writes.some(({ kind, table }) => kind === "delete" && table === mocks.tables.user)
    ).toBe(false);
  });

  it("deletes users with no remaining membership and relies on canonical cascades", async () => {
    const ownerRow = {
      membershipId: "owner-member",
      userId: "owner-user",
      status: "active",
      name: "Owner",
      email: "owner@example.com",
      username: "owner",
      isOrganizationRestricted: false,
      managingOrganizationId: null,
    };
    const orphanRow = {
      ...ownerRow,
      membershipId: "orphan-member",
      userId: "orphan-user",
      email: "orphan@example.com",
      isOrganizationRestricted: true,
      managingOrganizationId: "org-a",
      managingOrganizationIdSnapshot: "org-a",
      managingOrganizationSlugSnapshot: "acme",
      managingOrganizationNameSnapshot: "Acme",
    };
    mocks.selectRows = [
      [{ id: "org-a", slug: "acme", name: "Acme" }],
      [{ roleKey: "owner", permissionKey: "organization.delete" }],
      [ownerRow, orphanRow],
      [
        { id: "owner-member", userId: "owner-user", organizationId: "org-a" },
        { id: "orphan-member", userId: "orphan-user", organizationId: "org-a" },
      ],
      [],
    ];
    const result = await deleteOrganization(owner, "acme");
    expect(result.deletedUserIds).toEqual(["owner-user", "orphan-user"]);
    expect(
      mocks.writes.some(({ kind, table }) => kind === "delete" && table === mocks.tables.user)
    ).toBe(true);
    expect(
      mocks.writes.some(
        ({ kind, table }) => kind === "post-commit-update" && table === mocks.tables.session
      )
    ).toBe(false);
    expect(mocks.simulatedCascades).toEqual(
      expect.arrayContaining([
        "sessions",
        "accounts",
        "identity-grants",
        "authored-invitations",
        "memberships",
        "roles",
        "invitations",
        "organization-grants",
      ])
    );
    expect(mocks.auditRecord).toMatchObject({
      organizationId: null,
      organizationIdSnapshot: "org-a",
      organizationSlugSnapshot: "acme",
      actorUserId: null,
      actorMembershipId: null,
    });
    expect(
      (mocks.auditRecord?.metadata as { actor: { email: string; membershipId: string } }).actor
    ).toMatchObject({
      email: "owner@example.com",
      membershipId: "owner-member",
    });
  });

  it("reports failed post-commit cleanup and safely permits an idempotent retry", async () => {
    mocks.sessionCleanupFailure = true;
    mocks.selectRows = [
      [{ id: "org-a", slug: "acme", name: "Acme" }],
      [{ roleKey: "owner", permissionKey: "organization.delete" }],
      [
        {
          membershipId: "owner-member",
          userId: "owner-user",
          status: "active",
          name: "Owner",
          email: "owner@example.com",
          username: "owner",
          isOrganizationRestricted: false,
          managingOrganizationId: null,
        },
      ],
      [
        { id: "owner-member", userId: "owner-user", organizationId: "org-a" },
        { id: "other", userId: "owner-user", organizationId: "org-b" },
      ],
      [],
    ];
    const result = await deleteOrganization(owner, "acme");
    expect(result.sessionCleanupPending).toBe(true);
    mocks.sessionCleanupFailure = false;
    await clearDeletedOrganizationSessionContext("org-a", ["owner-user"]);
    await clearDeletedOrganizationSessionContext("org-a", ["owner-user"]);
    const cleanupWrites = mocks.writes.filter(
      ({ kind, table }) => kind === "post-commit-update" && table === mocks.tables.session
    );
    expect(cleanupWrites).toHaveLength(3);
    expect(cleanupWrites[1]?.where).toEqual(cleanupWrites[2]?.where);
  });

  it.each(["freeze", "audit", "organization-delete"] as const)(
    "rolls back all transaction writes after %s failure",
    async (phase) => {
      mocks.transactionFailure = phase;
      const restricted = {
        membershipId: "restricted-member",
        userId: "restricted-user",
        status: "active",
        name: "R",
        email: "r@example.com",
        username: "r",
        isOrganizationRestricted: true,
        managingOrganizationId: "org-a",
        managingOrganizationIdSnapshot: "org-a",
        managingOrganizationSlugSnapshot: "acme",
        managingOrganizationNameSnapshot: "Acme",
        allowlistFrozenAt: null,
      };
      mocks.selectRows = [
        [{ id: "org-a", slug: "acme", name: "Acme" }],
        [{ roleKey: "owner", permissionKey: "organization.delete" }],
        [restricted],
        [
          { id: "restricted-member", userId: "restricted-user", organizationId: "org-a" },
          { id: "other", userId: "restricted-user", organizationId: "org-b" },
        ],
        [{ id: "grant", subjectUserId: "restricted-user", allowedOrganizationId: "org-b" }],
      ];
      await expect(deleteOrganization(owner, "acme")).rejects.toThrow("injected");
      expect(mocks.writes).toEqual([]);
    }
  );
});
