import { eq, notExists } from "drizzle-orm";

import { db, dbPool } from "../src/db/drizzle";
import { permission, role, rolePermission, user, userRole } from "../src/db/schema";
import {
  permissionCatalog,
  permissionKeys,
  PERMISSIONS,
  type PermissionKey,
} from "../src/features/authorization/contracts";

const systemRoles: readonly {
  id: string;
  key: string;
  name: string;
  description: string;
  permissions: readonly PermissionKey[];
}[] = [
  {
    id: "system:member",
    key: "member",
    name: "Member",
    description: "Default access for every authenticated user",
    permissions: [PERMISSIONS.PROFILE_READ_OWN, PERMISSIONS.PROFILE_UPDATE_OWN],
  },
  {
    id: "system:admin",
    key: "admin",
    name: "Administrator",
    description: "Full explicit application administration access",
    permissions: permissionKeys,
  },
];

async function bootstrap() {
  await db.transaction(async (tx) => {
    for (const key of permissionKeys) {
      await tx
        .insert(permission)
        .values({ key, description: permissionCatalog[key] })
        .onConflictDoUpdate({
          target: permission.key,
          set: { description: permissionCatalog[key], updatedAt: new Date() },
        });
    }

    for (const systemRole of systemRoles) {
      await tx
        .insert(role)
        .values({
          id: systemRole.id,
          key: systemRole.key,
          name: systemRole.name,
          description: systemRole.description,
          isSystem: true,
        })
        .onConflictDoUpdate({
          target: role.id,
          set: {
            key: systemRole.key,
            name: systemRole.name,
            description: systemRole.description,
            isSystem: true,
            updatedAt: new Date(),
          },
        });
      await tx.delete(rolePermission).where(eq(rolePermission.roleId, systemRole.id));
      await tx.insert(rolePermission).values(
        systemRole.permissions.map((permissionKey) => ({
          roleId: systemRole.id,
          permissionKey,
        }))
      );
    }

    const usersWithoutRoles = await tx
      .select({ userId: user.id })
      .from(user)
      .where(notExists(tx.select().from(userRole).where(eq(userRole.userId, user.id))));
    if (usersWithoutRoles.length > 0) {
      await tx
        .insert(userRole)
        .values(usersWithoutRoles.map(({ userId }) => ({ userId, roleId: "system:member" })))
        .onConflictDoNothing();
    }
  });
  console.log("Authorization catalog and system roles synchronized.");
}

bootstrap()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => dbPool.end());
