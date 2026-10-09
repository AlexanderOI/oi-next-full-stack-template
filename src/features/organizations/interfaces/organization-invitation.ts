import type {
  createOrganizationInvitationSchema,
  organizationInvitationIdSchema,
} from "../schemas/organization-invitation-schema";
import type { z } from "zod";

export type CreateOrganizationInvitationInput = z.infer<typeof createOrganizationInvitationSchema>;
export type OrganizationInvitationIdInput = z.infer<typeof organizationInvitationIdSchema>;

export type OrganizationInvitationErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "ALREADY_MEMBER"
  | "INVITATION_NOT_PENDING"
  | "INVITATION_DELIVERY_FAILED"
  | "INVITATION_FAILED";

export type OrganizationInvitationResponseErrorCode =
  | "UNAUTHORIZED"
  | "VALIDATION_ERROR"
  | "INVITATION_NOT_FOUND"
  | "INVITATION_RECIPIENT_MISMATCH"
  | "EMAIL_NOT_VERIFIED"
  | "INVITATION_EXPIRED"
  | "INVITATION_NOT_PENDING"
  | "INVITATION_ROLE_INVALID"
  | "ORGANIZATION_NOT_FOUND"
  | "ORGANIZATION_RESTRICTED"
  | "ALREADY_MEMBER"
  | "ORGANIZATION_MEMBER_LIMIT_REACHED"
  | "INVITATION_STATE_INVARIANT"
  | "INVITATION_TRANSITION_CONFLICT"
  | "INVITATION_FAILED";

export type OrganizationInvitationResponseResult =
  | { success: true; data: { changed: boolean; invitationId: string } }
  | { success: false; code: OrganizationInvitationResponseErrorCode };

export type OrganizationInvitationResult =
  | {
      success: true;
      data: { invitationId: string; expiresAt?: string };
    }
  | {
      success: false;
      code: OrganizationInvitationErrorCode;
      details?: Record<string, string[]>;
      invitationId?: string;
      expiresAt?: string;
    };
