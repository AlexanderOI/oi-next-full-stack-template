import { permissionKeys } from "../constants/permission-catalog";
import type { AuthorizationRow } from "../interfaces/authorization-row";
import type { AuthorizationSnapshot } from "../interfaces/authorization-snapshot";
import type { PermissionKey } from "../interfaces/permission";

const knownPermissions = new Set<string>(permissionKeys);

export function buildAuthorizationSnapshot(
  userId: string,
  rows: readonly AuthorizationRow[]
): AuthorizationSnapshot {
  const roles = new Set<string>();
  const permissions = new Set<PermissionKey>();

  for (const row of rows) {
    if (row.userId !== userId) continue;
    if (row.roleKey) roles.add(row.roleKey);
    if (row.permissionKey && knownPermissions.has(row.permissionKey)) {
      permissions.add(row.permissionKey as PermissionKey);
    }
  }

  return {
    userId,
    roles: [...roles].sort(),
    permissions: [...permissions].sort(),
  };
}
