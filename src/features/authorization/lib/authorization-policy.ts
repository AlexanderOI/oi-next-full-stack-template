import { permissionKeys } from "../constants/permission-catalog";
import type { PermissionKey } from "../interfaces/permission";

const knownPermissions = new Set<string>(permissionKeys);

export function evaluatePermissions(
  granted: readonly PermissionKey[],
  requested: readonly string[],
  match: "all" | "any"
) {
  if (requested.length === 0 || requested.some((key) => !knownPermissions.has(key))) return false;
  const grantedSet = new Set(granted);
  return match === "all"
    ? requested.every((key) => grantedSet.has(key as PermissionKey))
    : requested.some((key) => grantedSet.has(key as PermissionKey));
}

export function canReplaceUserRoles(input: {
  actorUserId: string;
  targetUserId: string;
  actorKeepsAdministration: boolean;
  targetWasAdmin: boolean;
  targetWillBeAdmin: boolean;
  adminCount: number;
}) {
  if (input.actorUserId === input.targetUserId && !input.actorKeepsAdministration) return false;
  if (input.targetWasAdmin && !input.targetWillBeAdmin && input.adminCount <= 1) return false;
  return true;
}
