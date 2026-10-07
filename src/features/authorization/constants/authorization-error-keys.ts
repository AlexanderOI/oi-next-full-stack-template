import type { AuthorizationErrorCode } from "../interfaces/authorization-error-code";

export const authorizationErrorKeys: Record<AuthorizationErrorCode, string> = {
  VALIDATION_ERROR: "validation",
  UNAUTHORIZED: "unauthorized",
  FORBIDDEN: "forbidden",
  ROLE_NOT_FOUND: "roleNotFound",
  SYSTEM_ROLE_MODIFY: "systemRoleModify",
  MANAGEMENT_ACCESS: "managementAccess",
  ROLE_KEY_CONFLICT: "roleKeyConflict",
  ROLE_KEY_EMPTY: "roleKeyEmpty",
  SAVE_FAILED: "saveFailed",
  INVALID_ROLE: "invalidRole",
  SYSTEM_ROLE_DELETE: "systemRoleDelete",
  ROLE_ASSIGNED: "roleAssigned",
  DELETE_FAILED: "deleteFailed",
  INVALID_ASSIGNMENT: "invalidAssignment",
  USER_NOT_FOUND: "userNotFound",
  INVALID_ROLES: "invalidRoles",
  ADMIN_MISSING: "adminMissing",
  ADMINISTRATIVE_ACCESS: "administrativeAccess",
  UPDATE_FAILED: "updateFailed",
};
