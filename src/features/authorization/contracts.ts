import { z } from "zod";

export const PERMISSIONS = {
  PROFILE_READ_OWN: "profile.read.own",
  PROFILE_UPDATE_OWN: "profile.update.own",
  ROLES_READ: "authorization.roles.read",
  ROLES_CREATE: "authorization.roles.create",
  ROLES_UPDATE: "authorization.roles.update",
  ROLES_DELETE: "authorization.roles.delete",
  USERS_READ: "authorization.users.read",
  USER_ROLES_UPDATE: "authorization.user-roles.update",
  AUDIT_READ: "authorization.audit.read",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export type PermissionMatch = "all" | "any";

export interface PermissionDefinition {
  key: PermissionKey;
  name: string;
  description: string;
}

export interface PermissionSection {
  key: "profile" | "authorization";
  name: string;
  permissions: readonly PermissionDefinition[];
}

export const permissionCatalog: readonly PermissionSection[] = [
  {
    key: "profile",
    name: "Profile",
    permissions: [
      {
        key: PERMISSIONS.PROFILE_READ_OWN,
        name: "View own profile",
        description: "View personal profile details",
      },
      {
        key: PERMISSIONS.PROFILE_UPDATE_OWN,
        name: "Update own profile",
        description: "Update personal profile details, avatar, and password",
      },
    ],
  },
  {
    key: "authorization",
    name: "Authorization",
    permissions: [
      {
        key: PERMISSIONS.ROLES_READ,
        name: "View roles",
        description: "View roles and their permissions",
      },
      {
        key: PERMISSIONS.ROLES_CREATE,
        name: "Create roles",
        description: "Create configurable roles",
      },
      {
        key: PERMISSIONS.ROLES_UPDATE,
        name: "Update roles",
        description: "Update configurable roles",
      },
      {
        key: PERMISSIONS.ROLES_DELETE,
        name: "Delete roles",
        description: "Delete configurable roles",
      },
      {
        key: PERMISSIONS.USERS_READ,
        name: "View users",
        description: "View users and their role assignments",
      },
      {
        key: PERMISSIONS.USER_ROLES_UPDATE,
        name: "Manage user roles",
        description: "Assign and revoke user roles",
      },
      {
        key: PERMISSIONS.AUDIT_READ,
        name: "View authorization audit",
        description: "View authorization audit events",
      },
    ],
  },
] as const;

export const permissionKeys = permissionCatalog.flatMap(({ permissions }) =>
  permissions.map(({ key }) => key)
) as readonly PermissionKey[];
export const permissionKeySchema = z.enum(permissionKeys as [PermissionKey, ...PermissionKey[]]);

export interface AuthorizationSnapshot {
  userId: string;
  roles: readonly string[];
  permissions: readonly PermissionKey[];
}

export interface RoleSummary {
  id: string;
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: readonly PermissionKey[];
}

export interface UserRoleSummary {
  id: string;
  name: string;
  email: string;
  username: string | null;
  roleIds: readonly string[];
}

export function localizeSystemRoles(
  roles: readonly RoleSummary[],
  t: (key: "admin.name" | "admin.description" | "member.name" | "member.description") => string
): RoleSummary[] {
  return roles.map((role) => {
    if (!role.isSystem || (role.key !== "admin" && role.key !== "member")) return role;
    return {
      ...role,
      name: t(`${role.key}.name`),
      description: t(`${role.key}.description`),
    };
  });
}

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; code: AuthorizationErrorCode; details?: Record<string, string[]> };

export type AuthorizationErrorCode =
  | "VALIDATION_ERROR"
  | "FORBIDDEN"
  | "ROLE_NOT_FOUND"
  | "SYSTEM_ROLE_MODIFY"
  | "MANAGEMENT_ACCESS"
  | "ROLE_KEY_CONFLICT"
  | "ROLE_KEY_EMPTY"
  | "SAVE_FAILED"
  | "INVALID_ROLE"
  | "SYSTEM_ROLE_DELETE"
  | "ROLE_ASSIGNED"
  | "DELETE_FAILED"
  | "INVALID_ASSIGNMENT"
  | "USER_NOT_FOUND"
  | "INVALID_ROLES"
  | "ADMIN_MISSING"
  | "ADMINISTRATIVE_ACCESS"
  | "UPDATE_FAILED";

export const authorizationErrorKeys: Record<AuthorizationErrorCode, string> = {
  VALIDATION_ERROR: "validation",
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

export const roleInputSchema = z.object({
  id: z.string().min(1, "ROLE_ID_REQUIRED").optional(),
  name: z.string().trim().min(2, "ROLE_NAME_MIN").max(80, "ROLE_NAME_MAX"),
  description: z.string().trim().max(240, "DESCRIPTION_MAX"),
  permissions: z.array(permissionKeySchema).min(1, "PERMISSION_REQUIRED"),
});

export const userRolesInputSchema = z.object({
  userId: z.string().min(1, "USER_ID_REQUIRED"),
  roleIds: z.array(z.string().min(1, "ROLE_ID_REQUIRED")).min(1, "ROLE_REQUIRED"),
});

export type RoleInput = z.infer<typeof roleInputSchema>;
export type UserRolesInput = z.infer<typeof userRolesInputSchema>;
