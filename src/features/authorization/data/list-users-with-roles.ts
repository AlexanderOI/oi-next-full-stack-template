import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db/drizzle";
import { platformRoleAssignment, role, user } from "@/db/schema";
import type { UserRoleSummary } from "../interfaces/user-role-summary";

export async function listUsersWithRoles(): Promise<UserRoleSummary[]> {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      username: user.username,
      invitedAt: user.invitedAt,
      disabledAt: user.disabledAt,
      roleId: role.id,
    })
    .from(user)
    .leftJoin(platformRoleAssignment, eq(user.id, platformRoleAssignment.userId))
    .leftJoin(role, and(eq(platformRoleAssignment.roleId, role.id), eq(role.scope, "platform")))
    .orderBy(asc(user.name), asc(user.email), asc(user.id));

  const users = new Map<string, UserRoleSummary>();
  for (const { roleId, ...userSummary } of rows) {
    const current = users.get(userSummary.id) ?? { ...userSummary, roleIds: [] };
    if (roleId) current.roleIds = [...current.roleIds, roleId].sort();
    users.set(userSummary.id, current);
  }
  return [...users.values()];
}
