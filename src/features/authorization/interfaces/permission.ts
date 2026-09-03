import type { PERMISSIONS } from "../constants/permissions";

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
