import type { PermissionKey } from "./permission";

export interface AuthorizationSnapshot {
  userId: string;
  roles: readonly string[];
  permissions: readonly PermissionKey[];
}
