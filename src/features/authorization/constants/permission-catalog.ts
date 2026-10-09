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
        scope: "platform",
        isProtected: false,
      },
      {
        key: PERMISSIONS.PROFILE_UPDATE_OWN,
        name: "Update own profile",
        description: "Update personal profile details, avatar, and password",
        scope: "platform",
        isProtected: false,
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
        scope: "platform",
        isProtected: false,
      },
      {
        key: PERMISSIONS.ROLES_CREATE,
        name: "Create roles",
        description: "Create configurable roles",
        scope: "platform",
        isProtected: false,
      },
      {
        key: PERMISSIONS.ROLES_UPDATE,
        name: "Update roles",
        description: "Update configurable roles",
        scope: "platform",
        isProtected: false,
      },
      {
        key: PERMISSIONS.ROLES_DELETE,
        name: "Delete roles",
        description: "Delete configurable roles",
        scope: "platform",
        isProtected: false,
      },
      {
        key: PERMISSIONS.USERS_READ,
        name: "View users",
        description: "View users and their role assignments",
        scope: "platform",
        isProtected: false,
      },
      {
        key: PERMISSIONS.USERS_INVITE,
        name: "Invite users",
        description: "Invite new users to create an account",
        scope: "platform",
        isProtected: false,
      },
      {
        key: PERMISSIONS.USER_ACCESS_UPDATE,
        name: "Manage user access",
        description: "Disable and reactivate user access",
        scope: "platform",
        isProtected: false,
      },
      {
        key: PERMISSIONS.USER_ROLES_UPDATE,
        name: "Manage user roles",
        description: "Assign and revoke user roles",
        scope: "platform",
        isProtected: false,
      },
      {
        key: PERMISSIONS.AUDIT_READ,
        name: "View authorization audit",
        description: "View authorization audit events",
        scope: "platform",
        isProtected: false,
      },
    ],
  },
  {
    key: "organization",
    name: "Organization",
    permissions: [
      {
        key: PERMISSIONS.ORGANIZATION_READ,
        name: "View organization",
        description: "View organization details and settings",
        scope: "organization",
        isProtected: false,
      },
      {
        key: PERMISSIONS.ORGANIZATION_UPDATE,
        name: "Update organization",
        description: "Update organization details and settings",
        scope: "organization",
        isProtected: false,
      },
      {
        key: PERMISSIONS.ORGANIZATION_DELETE,
        name: "Delete organization",
        description: "Permanently delete the organization",
        scope: "organization",
        isProtected: false,
      },
      {
        key: PERMISSIONS.ORGANIZATION_AUDIT_READ,
        name: "View organization audit",
        description: "View organization authorization audit events",
        scope: "organization",
        isProtected: false,
      },
      {
        key: PERMISSIONS.ORGANIZATION_OWNERSHIP_TRANSFER,
        name: "Transfer ownership",
        description: "Transfer organization ownership to another active member",
        scope: "organization",
        isProtected: false,
      },
    ],
  },
  {
    key: "organization-members",
    name: "Organization members",
    permissions: [
      {
        key: PERMISSIONS.ORGANIZATION_MEMBERS_READ,
        name: "View members",
        description: "View organization members and their access",
        scope: "organization",
        isProtected: false,
      },
      {
        key: PERMISSIONS.ORGANIZATION_MEMBERS_PROVISION,
        name: "Provision members",
        description: "Provision new identities in the organization",
        scope: "organization",
        isProtected: false,
      },
      {
        key: PERMISSIONS.ORGANIZATION_MEMBER_ACCESS_UPDATE,
        name: "Manage member access",
        description: "Suspend and reactivate organization memberships",
        scope: "organization",
        isProtected: false,
      },
      {
        key: PERMISSIONS.ORGANIZATION_MEMBERS_REMOVE,
        name: "Remove members",
        description: "Remove memberships from the organization",
        scope: "organization",
        isProtected: false,
      },
    ],
  },
  {
    key: "organization-roles",
    name: "Organization roles",
    permissions: [
      {
        key: PERMISSIONS.ORGANIZATION_ROLES_READ,
        name: "View organization roles",
        description: "View protected and custom organization roles",
        scope: "organization",
        isProtected: false,
      },
      {
        key: PERMISSIONS.ORGANIZATION_ROLES_CREATE,
        name: "Create organization roles",
        description: "Create custom organization roles",
        scope: "organization",
        isProtected: false,
      },
      {
        key: PERMISSIONS.ORGANIZATION_ROLES_UPDATE,
        name: "Update organization roles",
        description: "Update custom organization roles",
        scope: "organization",
        isProtected: false,
      },
      {
        key: PERMISSIONS.ORGANIZATION_ROLES_DELETE,
        name: "Delete organization roles",
        description: "Delete unassigned custom organization roles",
        scope: "organization",
        isProtected: false,
      },
      {
        key: PERMISSIONS.ORGANIZATION_MEMBER_ROLES_UPDATE,
        name: "Manage member roles",
        description: "Assign and revoke roles for organization memberships",
        scope: "organization",
        isProtected: false,
      },
    ],
  },
  {
    key: "organization-invitations",
    name: "Organization invitations",
    permissions: [
      {
        key: PERMISSIONS.ORGANIZATION_INVITATIONS_READ,
        name: "View invitations",
        description: "View organization invitations",
        scope: "organization",
        isProtected: false,
      },
      {
        key: PERMISSIONS.ORGANIZATION_INVITATIONS_CREATE,
        name: "Create invitations",
        description: "Invite members with a selected organization role",
        scope: "organization",
        isProtected: false,
      },
      {
        key: PERMISSIONS.ORGANIZATION_INVITATIONS_CANCEL,
        name: "Cancel invitations",
        description: "Cancel pending organization invitations",
        scope: "organization",
        isProtected: false,
      },
      {
        key: PERMISSIONS.ORGANIZATION_INVITATIONS_RESEND,
        name: "Resend invitations",
        description: "Replace and resend pending organization invitations",
        scope: "organization",
        isProtected: false,
      },
    ],
  },
  {
    key: "organization-security",
    name: "Organization security",
    permissions: [
      {
        key: PERMISSIONS.ORGANIZATION_RESTRICTIONS_CREATE,
        name: "Create permanent restrictions",
        description: "Provision identities with permanent organization restrictions",
        scope: "organization",
        isProtected: true,
      },
      {
        key: PERMISSIONS.ORGANIZATION_ALLOWLIST_GRANTS_READ,
        name: "View allowlist grants",
        description: "View permanent organization exceptions for restricted identities",
        scope: "organization",
        isProtected: true,
      },
      {
        key: PERMISSIONS.ORGANIZATION_ALLOWLIST_GRANTS_CREATE,
        name: "Create allowlist grants",
        description: "Create permanent organization exceptions for restricted identities",
        scope: "organization",
        isProtected: true,
      },
    ],
  },
] as const;

export const permissionKeys = permissionCatalog.flatMap(({ permissions }) =>
  permissions.map(({ key }) => key)
) as readonly PermissionKey[];

export const platformPermissionKeys = permissionCatalog
  .flatMap(({ permissions }) => permissions)
  .filter(({ scope }) => scope === "platform")
  .map(({ key }) => key) as readonly PermissionKey[];
