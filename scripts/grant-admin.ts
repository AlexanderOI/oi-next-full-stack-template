import { or, eq } from "drizzle-orm";

import { db, dbPool } from "../src/db/drizzle";
import { authorizationAudit, role, user, userRole } from "../src/db/schema";

async function grantAdmin(identifier: string) {
  const [targetUser] = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(or(eq(user.id, identifier), eq(user.email, identifier), eq(user.username, identifier)))
    .limit(1);
  if (!targetUser) throw new Error("User not found by id, email, or username");

  const [adminRole] = await db
    .select({ id: role.id })
    .from(role)
    .where(eq(role.key, "admin"))
    .limit(1);
  if (!adminRole) throw new Error("Run db:bootstrap before granting an administrator");

  await db.transaction(async (tx) => {
    await tx
      .insert(userRole)
      .values({ userId: targetUser.id, roleId: adminRole.id })
      .onConflictDoNothing();
    await tx.insert(authorizationAudit).values({
      id: crypto.randomUUID(),
      actorUserId: null,
      action: "user.admin-granted-cli",
      targetType: "user",
      targetId: targetUser.id,
      metadata: { identifier, email: targetUser.email },
    });
  });
  console.log(`Administrator role granted to ${targetUser.email}.`);
}

const identifier = process.argv[2];
if (!identifier) {
  console.error("Usage: bun run auth:grant-admin <email|username|id>");
  process.exitCode = 1;
} else {
  grantAdmin(identifier)
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(() => dbPool.end());
}
