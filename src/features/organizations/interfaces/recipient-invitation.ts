export type RecipientInvitationStatus =
  "pending" | "accepted" | "rejected" | "canceled" | "expired";

export type RecipientInvitationView =
  | { state: "sign-in-required" }
  | { state: "verify-email"; canReject?: boolean }
  | { state: "unavailable" }
  | {
      state: "invitation";
      email: string;
      status: RecipientInvitationStatus;
      expiresAt: string;
      organizationId: string;
      organizationName: string;
      organizationSlug: string;
      roleName: string;
      canAccept: boolean;
      canReject: boolean;
      showSwitch: boolean;
      activeOrganizationName: string | null;
    };
