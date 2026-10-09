import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  queryResults: [] as unknown[][],
  insertValues: [] as unknown[][],
  updateValues: [] as unknown[][],
  deleteConditions: [] as unknown[],
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions) => ({ and: conditions })),
  eq: vi.fn((column, value) => ({ column, value })),
}));
vi.mock("@/db/drizzle", () => ({
  db: {
    transaction: mocks.transaction,
  },
}));
vi.mock("@/db/schema", () => ({
  member: {
    id: "member.id",
    organizationId: "member.organizationId",
    userId: "member.userId",
    role: "member.role",
    status: "member.status",
  },
  membershipRole: {
    membershipId: "membershipRole.membershipId",
    roleId: "membershipRole.roleId",
  },
  organization: {
    id: "organization.id",
    slug: "organization.slug",
    name: "organization.name",
    personalSignupOwnerUserId: "organization.personalSignupOwnerUserId",
  },
  role: { id: "role.id", key: "role.key", scope: "role.scope", isProtected: "role.isProtected" },
  user: { id: "user.id", initialActiveOrganizationId: "user.initialActiveOrganizationId" },
}));

import {
  compensateFailedPublicSignup,
  compensateFailedTrustedSignup,
  completePublicSignup,
} from "@/features/organizations/lib/complete-public-signup";

function configureTransaction() {
  const tx = {
    select: mocks.select,
    insert: mocks.insert,
    update: mocks.update,
    delete: mocks.delete,
  };
  mocks.transaction.mockImplementation(async (run: (transaction: typeof tx) => Promise<unknown>) =>
    run(tx)
  );
  mocks.select.mockImplementation(() => ({
    from: () => ({
      where: () => ({
        limit: async () => mocks.queryResults.shift(),
      }),
    }),
  }));
  mocks.insert.mockImplementation(() => ({
    values: (value: unknown) => {
      mocks.insertValues.push(value as unknown[]);
      return {
        onConflictDoNothing: () => ({
          returning: async () => mocks.queryResults.shift(),
        }),
      };
    },
  }));
  mocks.update.mockImplementation(() => ({
    set: (value: unknown) => {
      mocks.updateValues.push(value as unknown[]);
      return { where: async () => undefined };
    },
  }));
  mocks.delete.mockImplementation(() => ({
    where: async (condition: unknown) => {
      mocks.deleteConditions.push(condition);
      return undefined;
    },
  }));
}

describe("public signup organization onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryResults = [];
    mocks.insertValues = [];
    mocks.updateValues = [];
    mocks.deleteConditions = [];
    configureTransaction();
  });

  it("allocates a deterministic suffix when the username-derived slug is occupied", async () => {
    const organization = {
      id: "personal-org-user-1",
      slug: "alex-2",
      name: "Alex's organization",
      personalSignupOwnerUserId: "user-1",
    };
    mocks.queryResults = [
      [{ id: "system:organization:owner" }],
      [],
      [{ id: "another-organization" }],
      [],
      [organization],
    ];

    await expect(completePublicSignup("user-1", "Alex", "Alex")).resolves.toEqual(organization);

    expect(mocks.insertValues).toEqual([
      {
        id: organization.id,
        name: organization.name,
        slug: "alex-2",
        personalSignupOwnerUserId: "user-1",
      },

      {
        id: "personal-member-user-1",
        organizationId: organization.id,
        userId: "user-1",
        role: "owner",
        status: "active",
      },
      {
        membershipId: "personal-member-user-1",
        roleId: "system:organization:owner",
        assignedByMembershipId: null,
      },
    ]);
    expect(mocks.updateValues).toEqual([{ initialActiveOrganizationId: organization.id }]);
  });

  it("compensates by deleting the stable personal organization and identity together", async () => {
    await compensateFailedPublicSignup("user-1");

    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.delete.mock.calls.map(([table]) => table)).toEqual([
      expect.objectContaining({ id: "organization.id" }),
      expect.objectContaining({ id: "user.id" }),
    ]);
    expect(mocks.deleteConditions).toEqual([
      {
        and: [
          { column: "organization.id", value: "personal-org-user-1" },
          { column: "organization.personalSignupOwnerUserId", value: "user-1" },
        ],
      },
      { column: "user.id", value: "user-1" },
    ]);
  });

  it("compensates trusted signup by deleting only the identity in a transaction", async () => {
    await compensateFailedTrustedSignup("user-1");

    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.delete.mock.calls.map(([table]) => table)).toEqual([
      expect.objectContaining({ id: "user.id" }),
    ]);
    expect(mocks.deleteConditions).toEqual([{ column: "user.id", value: "user-1" }]);
  });

  it("propagates a failed cleanup transaction without attempting non-transactional deletes", async () => {
    const failure = new Error("cleanup transaction failed");
    mocks.transaction.mockRejectedValueOnce(failure);

    await expect(compensateFailedPublicSignup("user-1")).rejects.toBe(failure);

    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("rejects an inconsistent stable organization retry instead of accepting it", async () => {
    mocks.queryResults = [
      [{ id: "system:organization:owner" }],
      [
        {
          id: "personal-org-user-1",
          slug: "alex",
          name: "Alex's organization",
          personalSignupOwnerUserId: null,
        },
      ],
      [],
    ];

    await expect(completePublicSignup("user-1", "Alex", "Alex")).rejects.toThrow(
      "PUBLIC_SIGNUP_ONBOARDING_STATE_INCONSISTENT"
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each([null, "another-user"])(
    "rejects a deterministic organization with owner marker %s and scopes compensation",
    async (ownerUserId) => {
      mocks.queryResults = [
        [{ id: "system:organization:owner" }],
        [
          {
            id: "personal-org-user-1",
            slug: "alex",
            name: "Alex's organization",
            personalSignupOwnerUserId: ownerUserId,
          },
        ],
      ];

      await expect(completePublicSignup("user-1", "Alex", "Alex")).rejects.toThrow(
        "PUBLIC_SIGNUP_ONBOARDING_STATE_INCONSISTENT"
      );
      expect(mocks.update).not.toHaveBeenCalled();

      await compensateFailedPublicSignup("user-1");
      expect(mocks.deleteConditions[0]).toEqual({
        and: [
          { column: "organization.id", value: "personal-org-user-1" },
          { column: "organization.personalSignupOwnerUserId", value: "user-1" },
        ],
      });
    }
  );

  it("rejects a raced deterministic organization without matching signup provenance", async () => {
    mocks.queryResults = [
      [{ id: "system:organization:owner" }],
      [],
      [],
      [],
      [
        {
          id: "personal-org-user-1",
          slug: "alex",
          name: "Alex's organization",
          personalSignupOwnerUserId: "another-user",
        },
      ],
    ];

    await expect(completePublicSignup("user-1", "Alex", "Alex")).rejects.toThrow(
      "PUBLIC_SIGNUP_ONBOARDING_STATE_INCONSISTENT"
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("treats a retry as success only when the stable personal org and active owner assignment agree", async () => {
    const organization = {
      id: "personal-org-user-1",
      slug: "alex",
      name: "Alex's organization",
      personalSignupOwnerUserId: "user-1",
    };
    mocks.queryResults = [
      [{ id: "system:organization:owner" }],
      [organization],
      [{ id: "personal-member-user-1" }],
      [{ membershipId: "personal-member-user-1" }],
    ];

    await expect(completePublicSignup("user-1", "Alex", "Alex")).resolves.toEqual(organization);

    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalled();
  });
});
