export { authorizationErrorKeys } from "./constants/authorization-error-keys";
export { permissionCatalog, permissionKeys } from "./constants/permission-catalog";
export { PERMISSIONS } from "./constants/permissions";
export type { ActionResult } from "./interfaces/action-result";
export type { AuthorizationErrorCode } from "./interfaces/authorization-error-code";
export type { AuthorizationSnapshot } from "./interfaces/authorization-snapshot";
export type {
  PermissionDefinition,
  PermissionKey,
  PermissionMatch,
  PermissionSection,
} from "./interfaces/permission";
export type { RoleSummary } from "./interfaces/role-summary";
export type { UserRoleSummary } from "./interfaces/user-role-summary";
export { permissionKeySchema } from "./schemas/permission-key-schema";
export { roleInputSchema, type RoleInput } from "./schemas/role-input-schema";
export { userRolesInputSchema, type UserRolesInput } from "./schemas/user-roles-input-schema";
export { localizeSystemRoles } from "./utils/localize-system-roles";
