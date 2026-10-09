export interface OrganizationProvisioningInput {
  name: string;
  email: string;
  username: string;
  locale: string;
  restricted: boolean;
}

export type OrganizationProvisioningData = { userId: string };
export type OrganizationProvisioningResult =
  | { success: true; data: OrganizationProvisioningData }
  | {
      success: false;
      code: OrganizationProvisioningErrorCode;
      details?: Record<string, string[]>;
      pendingUserId?: string;
    };

export type OrganizationProvisioningErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "DUPLICATE_EMAIL"
  | "DUPLICATE_USERNAME"
  | "INVITATION_DELIVERY_FAILED"
  | "INVITATION_NOT_PENDING"
  | "PROVISIONING_FAILED"
  | "IDENTITY_COMPENSATION_FAILED";
