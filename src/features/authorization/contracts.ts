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

export const permissionKeys = Object.values(PERMISSIONS) as readonly PermissionKey[];
export const permissionKeySchema = z.enum(permissionKeys as [PermissionKey, ...PermissionKey[]]);

export const permissionCatalog: Readonly<Record<PermissionKey, string>> = {
  [PERMISSIONS.PROFILE_READ_OWN]: "View own profile",
  [PERMISSIONS.PROFILE_UPDATE_OWN]: "Update own profile, avatar, and password",
  [PERMISSIONS.ROLES_READ]: "View roles and their permissions",
  [PERMISSIONS.ROLES_CREATE]: "Create configurable roles",
  [PERMISSIONS.ROLES_UPDATE]: "Update configurable roles",
  [PERMISSIONS.ROLES_DELETE]: "Delete configurable roles",
  [PERMISSIONS.USERS_READ]: "View users and their role assignments",
  [PERMISSIONS.USER_ROLES_UPDATE]: "Assign and revoke user roles",
  [PERMISSIONS.AUDIT_READ]: "View authorization audit events",
};

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

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string; details?: Record<string, string[]> };

export const roleInputSchema = z.object({
  id: z.string().min(1).optional(),
  key: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[a-z][a-z0-9-]*$/, "Use lowercase letters, numbers, and hyphens"),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240),
  permissions: z.array(permissionKeySchema).min(1, "Select at least one permission"),
});

export const userRolesInputSchema = z.object({
  userId: z.string().min(1),
  roleIds: z.array(z.string().min(1)).min(1, "Each user must have at least one role"),
});

export type RoleInput = z.infer<typeof roleInputSchema>;
export type UserRolesInput = z.infer<typeof userRolesInputSchema>;
