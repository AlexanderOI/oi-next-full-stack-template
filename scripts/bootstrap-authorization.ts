import { and, eq, notExists } from "drizzle-orm";

import { db, dbPool } from "../src/db/drizzle";
import { permission, platformRoleAssignment, role, rolePermission, user } from "../src/db/schema";
import {
  permissionCatalog,
  platformPermissionKeys,
  PERMISSIONS,
  type PermissionKey,
} from "../src/features/authorization/contracts";

const systemRoles: readonly {
  id: string;
  key: string;
  name: string;
  description: string;
  scope: "platform" | "organization";
  organizationId?: null;
  isProtected: true;
  permissions: readonly PermissionKey[];
}[] = [
  {
    id: "system:member",
    key: "member",
    name: "Member",
    description: "Default access for every authenticated user",
    scope: "platform",
    isProtected: true,
    permissions: [PERMISSIONS.PROFILE_READ_OWN, PERMISSIONS.PROFILE_UPDATE_OWN],
  },
  {
    id: "system:admin",
    key: "admin",
    name: "Administrator",
    description: "Full explicit application administration access",
    scope: "platform",
    isProtected: true,
    permissions: platformPermissionKeys,
  },
  {
    id: "system:organization:owner",
    key: "owner",
    name: "Owner",
    description: "Full organization administration access",
    scope: "organization",
    organizationId: null,
    isProtected: true,
    permissions: permissionCatalog
      .flatMap(({ permissions }) => permissions)
      .filter(({ scope }) => scope === "organization")
      .map(({ key }) => key),
  },
  {
    id: "system:organization:admin",
    key: "admin",
    name: "Administrator",
    description: "Full organization administration access",
    scope: "organization",
    organizationId: null,
    isProtected: true,
    permissions: permissionCatalog
      .flatMap(({ permissions }) => permissions)
      .filter(({ scope }) => scope === "organization")
      .map(({ key }) => key),
  },
  {
    id: "system:organization:member",
    key: "member",
    name: "Member",
    description: "Read-only organization and member access",
    scope: "organization",
    organizationId: null,
    isProtected: true,
    permissions: [PERMISSIONS.ORGANIZATION_READ, PERMISSIONS.ORGANIZATION_MEMBERS_READ],
  },
];

export async function bootstrapAuthorization() {
  await db.transaction(async (tx) => {
    for (const section of permissionCatalog) {
      for (const definition of section.permissions) {
        await tx
          .insert(permission)
          .values({
            key: definition.key,
            name: definition.name,
            description: definition.description,
            category: section.key,
            scope: definition.scope,
            isProtected: definition.isProtected,
          })
          .onConflictDoUpdate({
            target: permission.key,
            set: {
              name: definition.name,
              description: definition.description,
              category: section.key,
              scope: definition.scope,
              isProtected: definition.isProtected,
              updatedAt: new Date(),
            },
          });
      }
    }

    for (const systemRole of systemRoles) {
      await tx
        .insert(role)
        .values({
          id: systemRole.id,
          key: systemRole.key,
          name: systemRole.name,
          description: systemRole.description,
          scope: systemRole.scope,
          ...(systemRole.scope === "organization" ? { organizationId: null } : {}),
          isSystem: true,
          isProtected: systemRole.isProtected,
        })
        .onConflictDoUpdate({
          target: role.id,
          set: {
            key: systemRole.key,
            name: systemRole.name,
            description: systemRole.description,
            scope: systemRole.scope,
            ...(systemRole.scope === "organization" ? { organizationId: null } : {}),
            isSystem: true,
            isProtected: systemRole.isProtected,
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

    const [memberRole] = await tx
      .select({ id: role.id })
      .from(role)
      .where(and(eq(role.key, "member"), eq(role.scope, "platform")))
      .limit(1);
    if (!memberRole) throw new Error("The platform member role was not bootstrapped");

    const usersWithoutRoles = await tx
      .select({ userId: user.id })
      .from(user)
      .where(
        notExists(
          tx.select().from(platformRoleAssignment).where(eq(platformRoleAssignment.userId, user.id))
        )
      );
    if (usersWithoutRoles.length > 0) {
      await tx
        .insert(platformRoleAssignment)
        .values(
          usersWithoutRoles.map(({ userId }) => ({
            userId,
            roleId: memberRole.id,
            assignedByUserId: null,
          }))
        )
        .onConflictDoNothing();
    }
  });
  console.log("Authorization catalog and system roles synchronized.");
}

if (import.meta.main) {
  bootstrapAuthorization()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(() => dbPool.end());
}
