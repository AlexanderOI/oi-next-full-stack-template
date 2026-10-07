import "server-only";

import { cache } from "react";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { db } from "@/db/drizzle";
import { permission, role, rolePermission, user, userRole } from "@/db/schema";
import { getCurrentSession, requireSession } from "@/features/auth/server";
import { permissionCatalog, permissionKeys } from "./constants/permission-catalog";
import { PERMISSIONS } from "./constants/permissions";
import { listUsersWithRoles } from "./data/list-users-with-roles";
import type { ActionResult } from "./interfaces/action-result";
import type { AuthorizationSnapshot } from "./interfaces/authorization-snapshot";
import type { PermissionKey } from "./interfaces/permission";
import type { RoleSummary } from "./interfaces/role-summary";
import type { UserRoleSummary } from "./interfaces/user-role-summary";
import { evaluatePermissions } from "./lib/authorization-policy";
import type { RoleInput } from "./schemas/role-input-schema";
import type { UserRolesInput } from "./schemas/user-roles-input-schema";
import { buildAuthorizationSnapshot } from "./utils/build-authorization-snapshot";
import { localizeSystemRoles } from "./utils/localize-system-roles";

export class AuthorizationError extends Error {
  constructor() {
    super("FORBIDDEN");
    this.name = "AuthorizationError";
  }
}

export const getAuthorizationContext = cache(async () => {
  const session = await getCurrentSession();
  if (!session) return null;

  const rows = await db
    .select({ userId: userRole.userId, roleKey: role.key, permissionKey: permission.key })
    .from(userRole)
    .innerJoin(user, eq(userRole.userId, user.id))
    .innerJoin(role, eq(userRole.roleId, role.id))
    .leftJoin(rolePermission, eq(role.id, rolePermission.roleId))
    .leftJoin(permission, eq(rolePermission.permissionKey, permission.key))
    .where(and(eq(userRole.userId, session.user.id), isNull(user.disabledAt)));

  return { session, snapshot: buildAuthorizationSnapshot(session.user.id, rows) };
});

export async function getAuthorizationSnapshot(): Promise<AuthorizationSnapshot | null> {
  return (await getAuthorizationContext())?.snapshot ?? null;
}

export async function can(permissionKey: PermissionKey) {
  const snapshot = await getAuthorizationSnapshot();
  return snapshot ? evaluatePermissions(snapshot.permissions, [permissionKey], "all") : false;
}

export async function canAny(permissionKeys: readonly PermissionKey[]) {
  const snapshot = await getAuthorizationSnapshot();
  return snapshot ? evaluatePermissions(snapshot.permissions, permissionKeys, "any") : false;
}

export async function canAll(permissionKeys: readonly PermissionKey[]) {
  const snapshot = await getAuthorizationSnapshot();
  return snapshot ? evaluatePermissions(snapshot.permissions, permissionKeys, "all") : false;
}

export async function assertPermission(permissionKey: PermissionKey) {
  if (!(await can(permissionKey))) throw new AuthorizationError();
}

export async function assertAnyPermission(permissionKeys: readonly PermissionKey[]) {
  if (!(await canAny(permissionKeys))) throw new AuthorizationError();
}

export async function assertAllPermissions(permissionKeys: readonly PermissionKey[]) {
  if (!(await canAll(permissionKeys))) throw new AuthorizationError();
}

export async function requireAuthorizedSession(permissionKey: PermissionKey) {
  const session = await requireSession();
  await assertPermission(permissionKey);
  return session;
}

export async function listRoles(): Promise<RoleSummary[]> {
  const rows = await db
    .select({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissionKey: rolePermission.permissionKey,
    })
    .from(role)
    .leftJoin(rolePermission, eq(role.id, rolePermission.roleId))
    .orderBy(asc(role.isSystem), asc(role.name));

  const roles = new Map<string, RoleSummary>();
  for (const row of rows) {
    const current = roles.get(row.id) ?? { ...row, permissions: [] };
    if (row.permissionKey) {
      current.permissions = [...current.permissions, row.permissionKey as PermissionKey].sort();
    }
    roles.set(row.id, current);
  }
  return [...roles.values()];
}

export async function listLocalizedRoles(): Promise<RoleSummary[]> {
  const [roles, t] = await Promise.all([listRoles(), getTranslations("authorization.systemRoles")]);
  return localizeSystemRoles(roles, t);
}

export async function getLocalizedPermissionCatalog() {
  const t = await getTranslations("authorization");
  return permissionCatalog.map((section) => ({
    ...section,
    name: t(`sections.${section.key}`),
    permissions: section.permissions.map((definition) => ({
      ...definition,
      name: t(`permissions.${definition.key}.name` as Parameters<typeof t>[0]),
      description: t(`permissions.${definition.key}.description` as Parameters<typeof t>[0]),
    })),
  }));
}

export { listUsersWithRoles, PERMISSIONS, permissionCatalog, permissionKeys };
export type {
  ActionResult,
  AuthorizationSnapshot,
  PermissionKey,
  RoleInput,
  RoleSummary,
  UserRolesInput,
  UserRoleSummary,
};
