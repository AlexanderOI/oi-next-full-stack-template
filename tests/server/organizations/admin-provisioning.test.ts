import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  selectLimit: vi.fn(),
  dbSelect: vi.fn(),
  hasPermission: vi.fn(),
  findConflict: vi.fn(),
  verifyIdentity: vi.fn(),
  createIdentity: vi.fn(),
  commit: vi.fn(),
  compensate: vi.fn(),
  deliver: vi.fn(),
  findPending: vi.fn(),
  transaction: vi.fn(),
  signUpEmail: vi.fn(),
  trustedRequest: vi.fn(),
  serviceSelectResults: [] as unknown[][],
  activeMemberCount: 0,
  serviceEvents: [] as string[],
  inserted: [] as Array<{ table: unknown; value: unknown }>,
  updated: [] as unknown[],
  failureAt: null as "membershipRole" | "audit" | null,
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions) => ({ and: conditions })),
  eq: vi.fn((column, value) => ({ column, value })),
  or: vi.fn((...conditions) => ({ or: conditions })),
  isNotNull: vi.fn((column) => ({ isNotNull: column })),
  count: vi.fn(() => "count"),
}));
vi.mock("@/db/schema", () => ({
  authorizationAudit: { id: "authorizationAudit.id" },
  member: {
    id: "member.id",
    userId: "member.userId",
    organizationId: "member.organizationId",
    status: "member.status",
  },
  membershipRole: { membershipId: "membershipRole.membershipId", roleId: "membershipRole.roleId" },
  organization: { id: "organization.id", slug: "organization.slug", name: "organization.name" },
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
  user: {
    id: "user.id",
    email: "user.email",
    username: "user.username",
    invitedAt: "user.invitedAt",
  },
}));
vi.mock("@/db/drizzle", () => ({
  db: {
    select: mocks.dbSelect.mockImplementation(() => ({
      from: () => ({ where: () => ({ limit: mocks.selectLimit }) }),
    })),
    transaction: mocks.transaction,
  },
}));
vi.mock("@/features/auth/server", () => ({
  getCurrentSession: mocks.getCurrentSession,
  auth: { api: { signUpEmail: mocks.signUpEmail } },
  createTrustedInvitationRequest: mocks.trustedRequest,
  requestInvitationPasswordReset: mocks.deliver,
}));
vi.mock("@/features/organizations/lib/admin-provisioning", () => ({
  hasOrganizationProvisionPermission: mocks.hasPermission,
  findProvisioningConflict: mocks.findConflict,
  verifyProvisionedIdentity: mocks.verifyIdentity,
  createProvisionedIdentity: mocks.createIdentity,
  commitOrganizationProvisioning: mocks.commit,
  compensateFailedTrustedSignup: mocks.compensate,
  deliverProvisioningActivation: mocks.deliver,
  findPendingOrganizationMember: mocks.findPending,
}));

import { authorizationAudit, membershipRole, organization } from "@/db/schema";
import {
  provisionOrganizationMember,
  resendOrganizationMemberActivation,
} from "@/features/organizations/actions/admin-provisioning";

const input = {
  name: "  Alex   Smith ",
  email: " ALEX@Example.com ",
  username: " Alex.Smith ",
  locale: "es" as const,
  restricted: false,
};

function setSession(activeOrganizationId: string | null = "org-1") {
  mocks.getCurrentSession.mockResolvedValue({
    user: { id: "actor-1" },
    session: { activeOrganizationId },
  });
  mocks.selectLimit.mockResolvedValue([{ id: "actor-membership-1" }]);
}

function setTransactionResults(...results: unknown[][]) {
  mocks.serviceSelectResults = [...results];
  const tx = {
    select: (projection: Record<string, unknown>) => {
      let table: unknown;
      const query = {
        from(value: unknown) {
          table = value;
          return query;
        },
        innerJoin() {
          return query;
        },
        where() {
          return query;
        },
        limit() {
          return query;
        },
        for() {
          mocks.serviceEvents.push("lock-organization");
          return query;
        },
        then(resolve: (value: unknown[]) => unknown) {
          const queued = mocks.serviceSelectResults.shift();
          if ("count" in projection) mocks.serviceEvents.push("count-active-members");
          const fallback =
            "count" in projection
              ? [{ count: mocks.activeMemberCount }]
              : table === organization
                ? [{ id: "org-1", slug: "acme", name: "Acme" }]
                : [];
          return Promise.resolve(queued ?? fallback).then(resolve);
        },
      };
      return query;
    },
    insert: (table: unknown) => ({
      values: async (value: unknown) => {
        mocks.serviceEvents.push("insert-membership");
        mocks.inserted.push({ table, value });
        if (
          (mocks.failureAt === "membershipRole" && table === membershipRole) ||
          (mocks.failureAt === "audit" && table === authorizationAudit)
        ) {
          throw new Error("injected transaction write failure");
        }
      },
    }),
    update: () => ({
      set: (value: unknown) => {
        mocks.updated.push(value);
        return { where: () => Promise.resolve() };
      },
    }),
  };
  mocks.transaction.mockImplementation(
    async (run: (transaction: typeof tx) => Promise<unknown>) => {
      const insertedBefore = structuredClone(mocks.inserted);
      const updatedBefore = structuredClone(mocks.updated);
      try {
        return await run(tx);
      } catch (error) {
        mocks.inserted = insertedBefore;
        mocks.updated = updatedBefore;
        throw error;
      }
    }
  );
}

describe("organization admin provisioning actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectLimit.mockResolvedValue([]);
    mocks.hasPermission.mockResolvedValue(true);
    mocks.findConflict.mockResolvedValue(null);
    mocks.verifyIdentity.mockResolvedValue(null);
    mocks.createIdentity.mockResolvedValue({ id: "new-user", email: "alex@example.com" });
    mocks.commit.mockResolvedValue(undefined);
    mocks.compensate.mockResolvedValue(undefined);
    mocks.deliver.mockResolvedValue(undefined);
    mocks.findPending.mockResolvedValue({ id: "new-user", email: "alex@example.com" });
    mocks.serviceSelectResults = [];
    mocks.activeMemberCount = 0;
    mocks.serviceEvents = [];
    mocks.signUpEmail.mockResolvedValue({ user: { id: "new-user", email: "alex@example.com" } });
    mocks.trustedRequest.mockReturnValue(new Request("http://localhost/api/auth/sign-up/email"));
    mocks.inserted = [];
    mocks.updated = [];
    mocks.failureAt = null;
    setSession();
  });

  it("creates a pending Better Auth identity through the trusted signup capability", async () => {
    const service = await vi.importActual<
      typeof import("@/features/organizations/lib/admin-provisioning")
    >("@/features/organizations/lib/admin-provisioning");
    await service.createProvisionedIdentity({
      name: "Alex Smith",
      email: "alex@example.com",
      username: "alex.smith",
      locale: "es",
      restricted: false,
    });

    expect(mocks.signUpEmail).toHaveBeenCalledWith({
      body: expect.objectContaining({
        name: "Alex Smith",
        email: "alex@example.com",
        username: "alex.smith",
        password: expect.stringMatching(/^[A-Za-z0-9_-]{40,}$/),
      }),
      request: expect.any(Request),
    });
    expect(mocks.trustedRequest).toHaveBeenCalledWith("http://localhost/api/auth/sign-up/email");
  });

  it("commits canonical member role, initial organization, restriction snapshots, and audit atomically", async () => {
    const service = await vi.importActual<
      typeof import("@/features/organizations/lib/admin-provisioning")
    >("@/features/organizations/lib/admin-provisioning");
    setTransactionResults(
      [
        { permissionKey: "organization.members.provision" },
        { permissionKey: "organization.restrictions.create" },
      ],
      [{ id: "actor-membership-1" }],
      [{ id: "org-1", slug: "acme", name: "Acme" }],
      [{ id: "system:organization:member" }]
    );

    await service.commitOrganizationProvisioning({
      actorId: "actor-1",
      actorMembershipId: "actor-membership-1",
      organizationId: "org-1",
      userId: "new-user",
      input: {
        ...input,
        name: "Alex Smith",
        email: "alex@example.com",
        username: "alex.smith",
        restricted: true,
      },
    });

    expect(mocks.inserted.map(({ table }) => table)).toEqual([
      expect.objectContaining({ id: "member.id" }),
      expect.objectContaining({ membershipId: "membershipRole.membershipId" }),
      expect.objectContaining({ id: "authorizationAudit.id" }),
    ]);
    expect(mocks.inserted[0]?.value).toMatchObject({
      organizationId: "org-1",
      userId: "new-user",
      role: "member",
      status: "active",
    });
    expect(mocks.inserted[1]?.value).toMatchObject({
      roleId: "system:organization:member",
      assignedByMembershipId: "actor-membership-1",
    });
    expect(mocks.inserted[2]?.value).toMatchObject({
      organizationId: "org-1",
      organizationSlugSnapshot: "acme",
      organizationNameSnapshot: "Acme",
      actorUserId: "actor-1",
      targetId: "new-user",
    });
    expect(mocks.updated[0]).toMatchObject({
      invitedAt: expect.any(Date),
      locale: "es",
      initialActiveOrganizationId: "org-1",
      isOrganizationRestricted: true,
      managingOrganizationId: "org-1",
      managingOrganizationIdSnapshot: "org-1",
      managingOrganizationSlugSnapshot: "acme",
      managingOrganizationNameSnapshot: "Acme",
    });
  });

  it("leaves unrestricted restriction state clear and does not write a restriction audit", async () => {
    const service = await vi.importActual<
      typeof import("@/features/organizations/lib/admin-provisioning")
    >("@/features/organizations/lib/admin-provisioning");
    setTransactionResults(
      [{ permissionKey: "organization.members.provision" }],
      [{ id: "actor-membership-1" }],
      [{ id: "org-1", slug: "acme", name: "Acme" }],
      [{ id: "system:organization:member" }]
    );

    await service.commitOrganizationProvisioning({
      actorId: "actor-1",
      actorMembershipId: "actor-membership-1",
      organizationId: "org-1",
      userId: "new-user",
      input: { ...input, name: "Alex Smith", email: "alex@example.com", username: "alex.smith" },
    });

    expect(mocks.updated[0]).toMatchObject({
      initialActiveOrganizationId: "org-1",
      isOrganizationRestricted: false,
      managingOrganizationId: null,
      managingOrganizationIdSnapshot: null,
      managingOrganizationSlugSnapshot: null,
      managingOrganizationNameSnapshot: null,
      allowlistFrozenAt: null,
    });
    expect(mocks.inserted).toHaveLength(2);
  });

  it("aborts the transaction before writes when actor authority is stale or protected role is missing", async () => {
    const service = await vi.importActual<
      typeof import("@/features/organizations/lib/admin-provisioning")
    >("@/features/organizations/lib/admin-provisioning");
    const args = {
      actorId: "actor-1",
      actorMembershipId: "actor-membership-1",
      organizationId: "org-1",
      userId: "new-user",
      input: { ...input, name: "Alex Smith", email: "alex@example.com", username: "alex.smith" },
    };
    setTransactionResults([{ permissionKey: "organization.members.provision" }], []);
    await expect(service.commitOrganizationProvisioning(args)).rejects.toThrow(
      "PROVISIONING_AUTHORITY_REVOKED"
    );
    expect(mocks.inserted).toHaveLength(0);

    setTransactionResults(
      [{ permissionKey: "organization.members.provision" }],
      [{ id: "actor-membership-1" }],
      [{ id: "org-1", slug: "acme", name: "Acme" }],
      []
    );
    await expect(service.commitOrganizationProvisioning(args)).rejects.toThrow(
      "PROVISIONING_MEMBER_ROLE_NOT_BOOTSTRAPPED"
    );
    expect(mocks.inserted).toHaveLength(0);
  });

  it.each(["membershipRole", "audit"] as const)(
    "rolls back admin provisioning writes when the %s insert fails",
    async (failureAt) => {
      const service = await vi.importActual<
        typeof import("@/features/organizations/lib/admin-provisioning")
      >("@/features/organizations/lib/admin-provisioning");
      setTransactionResults(
        [
          { permissionKey: "organization.members.provision" },
          { permissionKey: "organization.restrictions.create" },
        ],
        [{ id: "actor-membership-1" }],
        [{ id: "org-1", slug: "acme", name: "Acme" }],
        [{ id: "system:organization:member" }]
      );
      mocks.failureAt = failureAt;

      await expect(
        service.commitOrganizationProvisioning({
          actorId: "actor-1",
          actorMembershipId: "actor-membership-1",
          organizationId: "org-1",
          userId: "new-user",
          input: {
            ...input,
            name: "Alex Smith",
            email: "alex@example.com",
            username: "alex.smith",
            restricted: true,
          },
        })
      ).rejects.toThrow("injected transaction write failure");

      expect(mocks.inserted).toHaveLength(0);
      expect(mocks.updated).toHaveLength(0);
    }
  );

  it("enforces the shared cap inside provisioning before membership writes", async () => {
    const service = await vi.importActual<
      typeof import("@/features/organizations/lib/admin-provisioning")
    >("@/features/organizations/lib/admin-provisioning");
    setTransactionResults(
      [{ permissionKey: "organization.members.provision" }],
      [{ id: "actor-membership-1" }],
      [{ id: "org-1", slug: "acme", name: "Acme" }],
      [{ id: "system:organization:member" }]
    );
    mocks.activeMemberCount = 1000;
    await expect(
      service.commitOrganizationProvisioning({
        actorId: "actor-1",
        actorMembershipId: "actor-membership-1",
        organizationId: "org-1",
        userId: "new-user",
        input: { ...input, name: "Alex Smith", email: "alex@example.com", username: "alex.smith" },
      })
    ).rejects.toThrow("ORGANIZATION_MEMBER_LIMIT_REACHED");
    expect(mocks.inserted).toHaveLength(0);
    expect(mocks.serviceEvents.indexOf("lock-organization")).toBeLessThan(
      mocks.serviceEvents.indexOf("count-active-members")
    );
  });

  it("allows provisioning when 999 active members exist", async () => {
    const service = await vi.importActual<
      typeof import("@/features/organizations/lib/admin-provisioning")
    >("@/features/organizations/lib/admin-provisioning");
    setTransactionResults(
      [{ permissionKey: "organization.members.provision" }],
      [{ id: "actor-membership-1" }],
      [{ id: "org-1", slug: "acme", name: "Acme" }],
      [{ id: "system:organization:member" }]
    );
    mocks.activeMemberCount = 999;
    await service.commitOrganizationProvisioning({
      actorId: "actor-1",
      actorMembershipId: "actor-membership-1",
      organizationId: "org-1",
      userId: "new-user",
      input: { ...input, name: "Alex Smith", email: "alex@example.com", username: "alex.smith" },
    });
    expect(mocks.inserted).toHaveLength(2);
    expect(mocks.serviceEvents.indexOf("lock-organization")).toBeLessThan(
      mocks.serviceEvents.indexOf("count-active-members")
    );
    expect(mocks.serviceEvents.indexOf("count-active-members")).toBeLessThan(
      mocks.serviceEvents.indexOf("insert-membership")
    );
  });

  it("requires a session, active organization, active membership, and provision permission", async () => {
    mocks.getCurrentSession.mockResolvedValueOnce(null);
    await expect(provisionOrganizationMember(input)).resolves.toMatchObject({
      code: "UNAUTHORIZED",
    });

    setSession(null);
    await expect(provisionOrganizationMember(input)).resolves.toMatchObject({
      code: "UNAUTHORIZED",
    });

    setSession();
    mocks.selectLimit.mockResolvedValueOnce([]);
    await expect(provisionOrganizationMember(input)).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.hasPermission).not.toHaveBeenCalled();

    setSession();
    mocks.hasPermission.mockResolvedValueOnce(false);
    await expect(provisionOrganizationMember(input)).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.findConflict).not.toHaveBeenCalled();
    expect(mocks.createIdentity).not.toHaveBeenCalled();
  });

  it("requires restriction authority before looking up identity when restricted mode is selected", async () => {
    mocks.hasPermission.mockResolvedValue(false);
    await expect(
      provisionOrganizationMember({ ...input, restricted: true })
    ).resolves.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mocks.hasPermission).toHaveBeenCalledWith("actor-1", "org-1", true);
    expect(mocks.findConflict).not.toHaveBeenCalled();
  });

  it("creates the identity only after scoped authority and commits before activation delivery", async () => {
    const order: string[] = [];
    mocks.findConflict.mockImplementation(async () => {
      order.push("lookup");
      return null;
    });
    mocks.createIdentity.mockImplementation(async () => {
      order.push("identity");
      return { id: "new-user", email: "alex@example.com" };
    });
    mocks.commit.mockImplementation(async () => order.push("commit"));
    mocks.deliver.mockImplementation(async () => order.push("delivery"));

    await expect(provisionOrganizationMember(input)).resolves.toEqual({
      success: true,
      data: { userId: "new-user" },
    });
    expect(order).toEqual(["lookup", "identity", "commit", "delivery"]);
    expect(mocks.commit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "actor-1",
        actorMembershipId: "actor-membership-1",
        organizationId: "org-1",
        userId: "new-user",
        input: expect.objectContaining({
          name: "Alex Smith",
          email: "alex@example.com",
          restricted: false,
        }),
      })
    );
  });

  it("compensates a pre-created identity when capacity denial aborts provisioning", async () => {
    mocks.commit.mockRejectedValue(new Error("ORGANIZATION_MEMBER_LIMIT_REACHED"));

    await expect(provisionOrganizationMember(input)).resolves.toEqual({
      success: false,
      code: "PROVISIONING_FAILED",
    });

    expect(mocks.compensate).toHaveBeenCalledWith("new-user");
    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it("maps failed identity compensation to a safe public result", async () => {
    mocks.commit.mockRejectedValue(new Error("ORGANIZATION_MEMBER_LIMIT_REACHED"));
    mocks.compensate.mockRejectedValue(new Error("private cleanup detail"));

    await expect(provisionOrganizationMember(input)).resolves.toEqual({
      success: false,
      code: "IDENTITY_COMPENSATION_FAILED",
    });
    expect(mocks.compensate).toHaveBeenCalledWith("new-user");
  });

  it("compensates a newly created identity when transactional provisioning fails", async () => {
    mocks.commit.mockRejectedValue(new Error("transaction failed"));
    await expect(provisionOrganizationMember(input)).resolves.toMatchObject({
      code: "PROVISIONING_FAILED",
    });
    expect(mocks.compensate).toHaveBeenCalledWith("new-user");
    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it("does not delete a committed pending identity when activation delivery fails", async () => {
    mocks.deliver.mockRejectedValue(new Error("SMTP unavailable"));
    await expect(provisionOrganizationMember(input)).resolves.toEqual({
      success: false,
      code: "INVITATION_DELIVERY_FAILED",
      pendingUserId: "new-user",
    });
    expect(mocks.commit).toHaveBeenCalledOnce();
    expect(mocks.compensate).not.toHaveBeenCalled();
  });

  it("compensates a created identity before returning a post-create conflict", async () => {
    const order: string[] = [];
    mocks.findConflict.mockResolvedValueOnce(null);
    mocks.createIdentity.mockImplementation(async () => {
      order.push("identity");
      return { id: "new-user", email: "alex@example.com" };
    });
    mocks.verifyIdentity.mockImplementation(async () => {
      order.push("verify");
      return "DUPLICATE_EMAIL";
    });
    mocks.compensate.mockImplementation(async () => order.push("compensate"));

    await expect(provisionOrganizationMember(input)).resolves.toMatchObject({
      code: "DUPLICATE_EMAIL",
    });
    expect(order).toEqual(["identity", "verify", "compensate"]);
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it("reports a distinct safe result when post-create conflict compensation fails", async () => {
    mocks.findConflict.mockResolvedValueOnce(null);
    mocks.verifyIdentity.mockResolvedValueOnce("DUPLICATE_EMAIL");
    mocks.compensate.mockRejectedValueOnce(new Error("private cleanup detail"));

    await expect(provisionOrganizationMember(input)).resolves.toEqual({
      success: false,
      code: "IDENTITY_COMPENSATION_FAILED",
    });
    expect(mocks.compensate).toHaveBeenCalledWith("new-user");
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it("resends only for a pending membership in the derived active organization", async () => {
    await expect(resendOrganizationMemberActivation("new-user")).resolves.toEqual({
      success: true,
      data: { userId: "new-user" },
    });
    expect(mocks.findPending).toHaveBeenCalledWith("new-user", "org-1");
    expect(mocks.createIdentity).not.toHaveBeenCalled();

    mocks.findPending.mockResolvedValueOnce(null);
    await expect(resendOrganizationMemberActivation("other-org-user")).resolves.toMatchObject({
      code: "INVITATION_NOT_PENDING",
    });
  });
});
