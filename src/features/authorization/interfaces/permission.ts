import type { PERMISSIONS } from "../constants/permissions";

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export type PermissionMatch = "all" | "any";
export type PermissionScope = "platform" | "organization";

export interface PermissionDefinition {
  key: PermissionKey;
  name: string;
  description: string;
  scope: PermissionScope;
  isProtected: boolean;
}

export interface PermissionSection {
  key:
    | "profile"
    | "authorization"
    | "organization"
    | "organization-members"
    | "organization-roles"
    | "organization-invitations"
    | "organization-security";
  name: string;
  permissions: readonly PermissionDefinition[];
}
