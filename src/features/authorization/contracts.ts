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
  name: string;
  permissions: readonly PermissionDefinition[];
}

export const permissionCatalog: readonly PermissionSection[] = [
  {
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

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string; details?: Record<string, string[]> };

export const roleInputSchema = z.object({
  id: z.string().min(1).optional(),
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
