import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/drizzle", () => ({ db: {} }));
vi.mock("@/features/organizations/email/organization-invitation-email", () => ({
  deliverOrganizationInvitation: vi.fn(),
}));
vi.mock("@/features/authorization/server", () => ({ PERMISSIONS: {} }));

import {
  createInvitationTransitionPolicy,
  invitationAuditTarget,
  recipientEligibilityPolicy,
  roleNeedsOwnershipTransfer,
} from "@/features/organizations/lib/organization-invitations";

describe("organization invitation transition policy", () => {
  it("requires resend permission and exact expected id before replacing pending state", () => {
    expect(
      createInvitationTransitionPolicy({
        pendingInvitationId: "old-id",
        expectedInvitationId: "old-id",
        explicitReplacement: false,
        canResend: false,
      })
    ).toBe("FORBIDDEN");
  });

  it("never inserts after a conditional cancellation transition changes zero rows", () => {
    expect(
      createInvitationTransitionPolicy({
        pendingInvitationId: "old-id",
        expectedInvitationId: "old-id",
        explicitReplacement: true,
        canResend: true,
        transitionedRows: 0,
      })
    ).toBe("RACE");
  });

  it("does not classify a custom role named owner as the protected owner role", () => {
    expect(roleNeedsOwnershipTransfer({ isProtected: false, key: "owner" })).toBe(false);
    expect(roleNeedsOwnershipTransfer({ isProtected: true, key: "owner" })).toBe(true);
  });

  it("keeps unknown, managing-organization, and explicitly granted recipients eligible", () => {
    expect(
      recipientEligibilityPolicy({
        identityExists: false,
        organizationId: "org",
        isMember: false,
        hasExplicitGrant: false,
      })
    ).toBe("eligible");
    expect(
      recipientEligibilityPolicy({
        identityExists: true,
        isOrganizationRestricted: true,
        managingOrganizationId: "org",
        organizationId: "org",
        isMember: false,
        hasExplicitGrant: false,
      })
    ).toBe("eligible");
    expect(
      recipientEligibilityPolicy({
        identityExists: true,
        isOrganizationRestricted: true,
        managingOrganizationId: null,
        organizationId: "org",
        isMember: false,
        hasExplicitGrant: true,
      })
    ).toBe("eligible");
    expect(
      recipientEligibilityPolicy({
        identityExists: true,
        isOrganizationRestricted: true,
        managingOrganizationId: null,
        organizationId: "org",
        isMember: false,
        hasExplicitGrant: false,
      })
    ).toBe("restricted");
  });

  it("stores only a one-way digest as the audit target", () => {
    const token = "raw-invitation-capability";
    const target = invitationAuditTarget(token);
    expect(target).toMatch(/^[a-f0-9]{64}$/);
    expect(target).not.toContain(token);
  });

  it("allows insertion only after the exact pending row was transitioned", () => {
    expect(
      createInvitationTransitionPolicy({
        pendingInvitationId: "old-id",
        expectedInvitationId: "old-id",
        explicitReplacement: true,
        canResend: true,
        transitionedRows: 1,
      })
    ).toBe("REPLACE");
  });
});
