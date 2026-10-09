import type { OrganizationErrorCode } from "./organization-error-code";

export interface OrganizationDeletionResult {
  organizationId: string;
  deletedUserIds: string[];
  survivingUserIds: string[];
  sessionCleanupPending: boolean;
}

export interface OrganizationMemberRemovalResult {
  memberId: string;
  changed: boolean;
  identityDeleted: boolean;
}

export type OrganizationResult<T> =
  | { success: true; data: T }
  | { success: false; code: OrganizationErrorCode; details?: Record<string, string[]> };
