"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db/drizzle";
import { authorizationAudit, role, rolePermission, userRole } from "@/db/schema";
import { getFieldErrors } from "@/lib/utils";
import { type ActionResult, PERMISSIONS, type RoleInput, roleInputSchema } from "../contracts";
import { deriveRoleKey, ROLE_KEY_CONFLICT_ERROR, ROLE_KEY_EMPTY_ERROR } from "../role-key";
import { requireAuthorizedSession } from "../server";

function isUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("code" in error && error.code === "23505") return true;
  return "cause" in error && isUniqueConstraintError(error.cause);
}

export async function saveRole(input: RoleInput): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireAuthorizedSession(
      input.id ? PERMISSIONS.ROLES_UPDATE : PERMISSIONS.ROLES_CREATE
    );
    const parsed = roleInputSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Validation failed", details: getFieldErrors(parsed.error) };
    }

    const key = deriveRoleKey(parsed.data.name);
    const id = parsed.data.id ?? crypto.randomUUID();
    await db.transaction(async (tx) => {
      if (parsed.data.id) {
        const [existing] = await tx
          .select({ isSystem: role.isSystem })
          .from(role)
          .where(eq(role.id, id))
          .limit(1);
        if (!existing) throw new Error("Role not found");
        if (existing.isSystem) throw new Error("System roles cannot be modified");

        if (!parsed.data.permissions.includes(PERMISSIONS.ROLES_UPDATE)) {
          const [actorHasOtherManagementRole] = await tx
            .select({ roleId: userRole.roleId })
            .from(userRole)
            .innerJoin(rolePermission, eq(userRole.roleId, rolePermission.roleId))
            .where(
              and(
                eq(userRole.userId, session.user.id),
                ne(userRole.roleId, id),
                eq(rolePermission.permissionKey, PERMISSIONS.ROLES_UPDATE)
              )
            )
            .limit(1);
          const [actorHasTargetRole] = await tx
            .select({ roleId: userRole.roleId })
            .from(userRole)
            .where(and(eq(userRole.userId, session.user.id), eq(userRole.roleId, id)))
            .limit(1);
          if (actorHasTargetRole && !actorHasOtherManagementRole) {
            throw new Error("This change would remove your role management access");
          }
        }
        const [keyConflict] = await tx
          .select({ id: role.id })
          .from(role)
          .where(and(eq(role.key, key), ne(role.id, id)))
          .limit(1);
        if (keyConflict) throw new Error(ROLE_KEY_CONFLICT_ERROR);
        await tx
          .update(role)
          .set({
            key,
            name: parsed.data.name,
            description: parsed.data.description,
            updatedAt: new Date(),
          })
          .where(eq(role.id, id));
        await tx.delete(rolePermission).where(eq(rolePermission.roleId, id));
      } else {
        const [keyConflict] = await tx
          .select({ id: role.id })
          .from(role)
          .where(eq(role.key, key))
          .limit(1);
        if (keyConflict) throw new Error(ROLE_KEY_CONFLICT_ERROR);
        await tx.insert(role).values({
          id,
          key,
          name: parsed.data.name,
          description: parsed.data.description,
        });
      }

      await tx
        .insert(rolePermission)
        .values(parsed.data.permissions.map((permissionKey) => ({ roleId: id, permissionKey })));
      await tx.insert(authorizationAudit).values({
        id: crypto.randomUUID(),
        actorUserId: session.user.id,
        action: parsed.data.id ? "role.updated" : "role.created",
        targetType: "role",
        targetId: id,
        metadata: { key, permissions: parsed.data.permissions },
      });
    });

    revalidatePath("/admin/roles");
    return { success: true, data: { id } };
  } catch (error) {
    const safeMessages = new Set([
      "Forbidden",
      "Role not found",
      "System roles cannot be modified",
      "This change would remove your role management access",
      ROLE_KEY_CONFLICT_ERROR,
      ROLE_KEY_EMPTY_ERROR,
    ]);
    const message = error instanceof Error ? error.message : "";
    return {
      success: false,
      error: isUniqueConstraintError(error)
        ? ROLE_KEY_CONFLICT_ERROR
        : safeMessages.has(message)
          ? message
          : "Unable to save role",
    };
  }
}

export async function deleteRole(roleId: string): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession(PERMISSIONS.ROLES_DELETE);
    if (!roleId) return { success: false, error: "Invalid role" };

    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ key: role.key, isSystem: role.isSystem })
        .from(role)
        .where(eq(role.id, roleId))
        .limit(1);
      if (!existing) throw new Error("Role not found");
      if (existing.isSystem) throw new Error("System roles cannot be deleted");
      const [assignment] = await tx
        .select({ userId: userRole.userId })
        .from(userRole)
        .where(eq(userRole.roleId, roleId))
        .limit(1);
      if (assignment) throw new Error("Remove this role from all users before deleting it");

      await tx.delete(role).where(eq(role.id, roleId));
      await tx.insert(authorizationAudit).values({
        id: crypto.randomUUID(),
        actorUserId: session.user.id,
        action: "role.deleted",
        targetType: "role",
        targetId: roleId,
        metadata: { key: existing.key },
      });
    });

    revalidatePath("/admin/roles");
    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    const safeMessages = new Set([
      "Forbidden",
      "Role not found",
      "System roles cannot be deleted",
      "Remove this role from all users before deleting it",
    ]);
    const message = error instanceof Error ? error.message : "";
    return { success: false, error: safeMessages.has(message) ? message : "Unable to delete role" };
  }
}
