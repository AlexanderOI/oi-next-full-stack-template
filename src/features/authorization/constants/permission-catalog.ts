import { PERMISSIONS } from "./permissions";
import type { PermissionKey, PermissionSection } from "../interfaces/permission";

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
        key: PERMISSIONS.USERS_INVITE,
        name: "Invite users",
        description: "Invite new users to create an account",
      },
      {
        key: PERMISSIONS.USER_ACCESS_UPDATE,
        name: "Manage user access",
        description: "Disable and reactivate user access",
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
