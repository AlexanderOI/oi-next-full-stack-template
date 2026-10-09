import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ select: vi.fn(), db: { select: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => ({ op: "and", conditions }),
  eq: (column: unknown, value: unknown) => ({ op: "eq", column, value }),
}));
vi.mock("@/db/drizzle", () => ({ db: mocks.db }));
vi.mock("@/db/schema", () => ({
  invitation: {
    id: "invitation.id",
    organizationId: "invitation.organizationId",
    email: "invitation.email",
    role: "invitation.role",
    status: "invitation.status",
    expiresAt: "invitation.expiresAt",
  },
  organization: {
    id: "organization.id",
    name: "organization.name",
    slug: "organization.slug",
  },
  role: {
    id: "role.id",
    name: "role.name",
    scope: "role.scope",
    organizationId: "role.organizationId",
    isProtected: "role.isProtected",
  },
  member: {
    organizationId: "member.organizationId",
    userId: "member.userId",
    status: "member.status",
  },
  user: {
    id: "user.id",
    email: "user.email",
    emailVerified: "user.emailVerified",
    disabledAt: "user.disabledAt",
  },
}));

import { getRecipientInvitation } from "@/features/organizations/lib/get-recipient-invitation";

function query(result: unknown) {
  const builder = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

const session = { user: { id: "user-1" }, session: { activeOrganizationId: "other-org" } };
const row = {
  id: "secret-capability",
  email: "recipient@example.com",
  status: "pending",
  expiresAt: new Date("2031-01-01"),
  organizationId: "target-org",
  roleId: "role-1",
};
const details = {
  organizationName: "Target Org",
  organizationSlug: "target",
  roleName: "Analyst",
  roleScope: "organization",
  roleOrganizationId: "target-org",
  roleIsProtected: false,
};
const verifiedIdentity = {
  email: "recipient@example.com",
  emailVerified: true,
  disabledAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.select.mockReset();
  mocks.db.select
    .mockReturnValueOnce(query([verifiedIdentity]))
    .mockReturnValueOnce(query([row]))
    .mockReturnValueOnce(query([details]));
});

describe("getRecipientInvitation", () => {
  it("does not read invitation data without a session", async () => {
    await expect(getRecipientInvitation("secret-capability", null)).resolves.toEqual({
      state: "sign-in-required",
    });
    expect(mocks.db.select).not.toHaveBeenCalled();
  });

  it("returns the same generic state for unknown and mismatched recipients", async () => {
    mocks.db.select
      .mockReset()
      .mockReturnValueOnce(query([{ ...verifiedIdentity, email: "wrong@example.com" }]))
      .mockReturnValueOnce(query([row]));
    await expect(getRecipientInvitation("secret-capability", session)).resolves.toEqual({
      state: "unavailable",
    });
    expect(mocks.db.select).toHaveBeenCalledTimes(2);

    mocks.db.select
      .mockReset()
      .mockReturnValueOnce(query([verifiedIdentity]))
      .mockReturnValueOnce(query([]));
    await expect(getRecipientInvitation("missing", session)).resolves.toEqual({
      state: "unavailable",
    });
  });

  it("does not disclose invitation details before email verification", async () => {
    mocks.db.select
      .mockReset()
      .mockReturnValueOnce(query([{ ...verifiedIdentity, emailVerified: false }]))
      .mockReturnValueOnce(query([row]));
    await expect(getRecipientInvitation("secret-capability", session)).resolves.toEqual({
      state: "verify-email",
      canReject: true,
    });
    expect(mocks.db.select).toHaveBeenCalledTimes(2);
  });

  it("returns matching verified pending details and capability-gated actions", async () => {
    const result = await getRecipientInvitation("secret-capability", session);
    expect(result).toMatchObject({
      state: "invitation",
      email: "recipient@example.com",
      status: "pending",
      organizationName: "Target Org",
      roleName: "Analyst",
      canAccept: true,
      canReject: true,
      showSwitch: false,
    });
  });

  it("returns consistent accepted view and exposes switch only for an existing different membership", async () => {
    mocks.db.select
      .mockReset()
      .mockReturnValueOnce(query([verifiedIdentity]))
      .mockReturnValueOnce(query([{ ...row, status: "accepted" }]))
      .mockReturnValueOnce(query([details]))
      .mockReturnValueOnce(query([{ organizationId: "target-org" }]))
      .mockReturnValueOnce(query([{ name: "Other Org" }]));
    await expect(getRecipientInvitation("secret-capability", session)).resolves.toMatchObject({
      state: "invitation",
      status: "accepted",
      canAccept: false,
      canReject: false,
      showSwitch: true,
    });
  });

  it("classifies expired and terminal invitations without offering response actions", async () => {
    mocks.db.select
      .mockReset()
      .mockReturnValueOnce(query([verifiedIdentity]))
      .mockReturnValueOnce(query([{ ...row, expiresAt: new Date("2000-01-01") }]))
      .mockReturnValueOnce(query([details]));
    await expect(getRecipientInvitation("secret-capability", session)).resolves.toMatchObject({
      state: "invitation",
      status: "expired",
      canAccept: false,
      canReject: false,
    });

    mocks.db.select
      .mockReset()
      .mockReturnValueOnce(query([verifiedIdentity]))
      .mockReturnValueOnce(query([{ ...row, status: "rejected" }]))
      .mockReturnValueOnce(query([details]));
    await expect(getRecipientInvitation("secret-capability", session)).resolves.toMatchObject({
      state: "invitation",
      status: "rejected",
      canAccept: false,
      canReject: false,
    });
  });
});
