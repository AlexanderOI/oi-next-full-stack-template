export type UserAccessStatus = "active" | "disabled";

export type UserAccessErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "USER_NOT_FOUND"
  | "SELF_DISABLE_FORBIDDEN"
  | "LAST_ACTIVE_MANAGER"
  | "INVITATION_PENDING"
  | "ACCESS_UPDATE_FAILED";

export type UserAccessResult =
  | {
      success: true;
      data: { userId: string; status: UserAccessStatus; changed: boolean };
    }
  | { success: false; code: UserAccessErrorCode };
