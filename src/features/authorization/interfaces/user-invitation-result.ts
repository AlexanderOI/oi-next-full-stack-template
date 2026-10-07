export type UserInvitationErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "DUPLICATE_EMAIL"
  | "DUPLICATE_USERNAME"
  | "INVITATION_NOT_PENDING"
  | "INVITATION_DELIVERY_FAILED"
  | "INVITATION_FAILED";

export type UserInvitationResult =
  | { success: true; data: { userId: string } }
  | {
      success: false;
      code: UserInvitationErrorCode;
      details?: Record<string, string[]>;
      pendingUserId?: string;
    };
