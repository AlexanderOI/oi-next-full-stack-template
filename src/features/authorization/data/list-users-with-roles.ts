import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "@/db/drizzle";
import { user, userRole } from "@/db/schema";
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
      roleId: userRole.roleId,
    })
    .from(user)
    .leftJoin(userRole, eq(user.id, userRole.userId))
    .orderBy(asc(user.name), asc(user.email), asc(user.id));

  const users = new Map<string, UserRoleSummary>();
  for (const { roleId, ...userSummary } of rows) {
    const current = users.get(userSummary.id) ?? { ...userSummary, roleIds: [] };
    if (roleId) current.roleIds = [...current.roleIds, roleId].sort();
    users.set(userSummary.id, current);
  }
  return [...users.values()];
}
