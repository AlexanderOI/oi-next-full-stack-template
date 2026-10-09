import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  selectLimit: vi.fn(),
  permission: vi.fn(),
  create: vi.fn(),
  cancel: vi.fn(),
  findPending: vi.fn(),
  resend: vi.fn(),
  deliver: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions) => ({ and: conditions })),
  eq: vi.fn((column, value) => ({ column, value })),
}));
vi.mock("@/db/schema", () => ({
  member: {
    id: "member.id",
    userId: "member.userId",
    organizationId: "member.organizationId",
    status: "member.status",
  },
}));
vi.mock("@/db/drizzle", () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ limit: mocks.selectLimit }) }) }) },
}));
vi.mock("@/features/auth/server", () => ({ getCurrentSession: mocks.getCurrentSession }));
vi.mock("@/features/organizations/lib/organization-invitations", () => ({
  hasInvitationPermission: mocks.permission,
  createOrReplaceInvitation: mocks.create,
  cancelInvitation: mocks.cancel,
  findPendingByEmail: mocks.findPending,
  findPendingInvitation: mocks.findPending,
  resendInvitation: mocks.resend,
  deliverInvitationEmail: mocks.deliver,
}));

import {
  cancelOrganizationInvitation,
  createOrganizationInvitation,
  resendOrganizationInvitation,
} from "@/features/organizations/actions/organization-invitations";

const pending = {
  id: "fresh-capability-id",
  email: "person@example.com",
  role: "custom-role-id",
  expiresAt: new Date("2030-01-03T12:00:00.000Z"),
  organizationName: "Acme",
  roleName: "Analyst",
};

function setSession(activeOrganizationId: string | null = "org-active") {
  mocks.getCurrentSession.mockResolvedValue({
    user: { id: "actor-id" },
    session: { activeOrganizationId },
  });
  mocks.selectLimit.mockResolvedValue([{ id: "membership-id" }]);
}

describe("organization invitation actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSession();
    mocks.permission.mockResolvedValue(true);
    mocks.create.mockResolvedValue(pending);
    mocks.findPending.mockResolvedValue(pending);
    mocks.resend.mockResolvedValue(pending);
    mocks.cancel.mockResolvedValue("CANCELED");
    mocks.deliver.mockResolvedValue(undefined);
  });

  it("denies creation before looking up an identity and derives organization from the active session", async () => {
    mocks.permission.mockResolvedValue(false);

    await expect(
      createOrganizationInvitation({ email: "unknown@example.com", roleId: "role-id" })
    ).resolves.toEqual({ success: false, code: "FORBIDDEN" });

    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.permission).toHaveBeenCalledWith(
      { userId: "actor-id", organizationId: "org-active", membershipId: "membership-id" },
      ["organization.invitations.create", "organization.member-roles.update"]
    );
  });

  it("normalizes email, permits unknown addresses, and delivers only after persistence returns", async () => {
    mocks.findPending.mockResolvedValue(null);
    const order: string[] = [];
    mocks.create.mockImplementation(async (...args: unknown[]) => {
      order.push("persisted");
      expect(args).toEqual([
        { userId: "actor-id", organizationId: "org-active", membershipId: "membership-id" },
        "unknown@example.com",
        "custom-role-id",
        false,
        undefined,
      ]);
      return pending;
    });
    mocks.deliver.mockImplementation(async () => order.push("delivery"));

    const result = await createOrganizationInvitation({
      email: " Unknown@Example.COM ",
      roleId: "custom-role-id",
    });

    expect(result).toEqual({
      success: true,
      data: { invitationId: pending.id, expiresAt: pending.expiresAt.toISOString() },
    });
    expect(order).toEqual(["persisted", "delivery"]);
  });

  it("requires resend permission and passes the exact pending invitation id for replacement", async () => {
    mocks.findPending.mockResolvedValue(pending);
    mocks.permission.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(
      createOrganizationInvitation({ email: "person@example.com", roleId: "role-id" })
    ).resolves.toEqual({ success: false, code: "FORBIDDEN" });
    expect(mocks.create).not.toHaveBeenCalled();

    mocks.permission.mockResolvedValue(true);
    await createOrganizationInvitation({ email: "person@example.com", roleId: "role-id" });
    expect(mocks.create).toHaveBeenCalledWith(
      { userId: "actor-id", organizationId: "org-active", membershipId: "membership-id" },
      pending.email,
      "role-id",
      true,
      pending.id
    );
  });

  it("keeps a committed invitation resendable when email delivery fails", async () => {
    mocks.deliver.mockRejectedValue(new Error("SMTP failed"));

    await expect(
      createOrganizationInvitation({ email: "person@example.com", roleId: "role-id" })
    ).resolves.toEqual({
      success: false,
      code: "INVITATION_DELIVERY_FAILED",
      invitationId: pending.id,
      expiresAt: pending.expiresAt.toISOString(),
    });
    expect(mocks.create).toHaveBeenCalledOnce();
  });

  it("scopes cancellation and resend to the active organization invitation id", async () => {
    await expect(cancelOrganizationInvitation({ invitationId: "invite-id" })).resolves.toEqual({
      success: true,
      data: { invitationId: "invite-id" },
    });
    expect(mocks.cancel).toHaveBeenCalledWith(
      { userId: "actor-id", organizationId: "org-active", membershipId: "membership-id" },
      "invite-id"
    );

    await expect(
      resendOrganizationInvitation({ invitationId: "invite-id" })
    ).resolves.toMatchObject({
      success: true,
      data: { invitationId: pending.id },
    });
    expect(mocks.findPending).toHaveBeenCalledWith("org-active", "invite-id");
    expect(mocks.resend).toHaveBeenCalledWith(
      { userId: "actor-id", organizationId: "org-active", membershipId: "membership-id" },
      "invite-id"
    );
  });

  it("maps a resend race to the current pending state, never FORBIDDEN", async () => {
    mocks.resend.mockResolvedValue("RACE");
    mocks.findPending.mockResolvedValue(pending);

    await expect(resendOrganizationInvitation({ invitationId: "invite-id" })).resolves.toEqual({
      success: true,
      data: { invitationId: pending.id, expiresAt: pending.expiresAt.toISOString() },
    });
    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it("does not accept a missing active membership", async () => {
    setSession();
    mocks.selectLimit.mockResolvedValueOnce([]);

    await expect(
      createOrganizationInvitation({ email: "person@example.com", roleId: "role-id" })
    ).resolves.toEqual({ success: false, code: "UNAUTHORIZED" });
    expect(mocks.permission).not.toHaveBeenCalled();
  });
});
