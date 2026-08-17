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
      return { success: false, code: "VALIDATION_ERROR", details: getFieldErrors(parsed.error) };
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
        if (!existing) throw new Error("ROLE_NOT_FOUND");
        if (existing.isSystem) throw new Error("SYSTEM_ROLE_MODIFY");

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
            throw new Error("MANAGEMENT_ACCESS");
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
    const safeCodes = new Set([
      "FORBIDDEN",
      "ROLE_NOT_FOUND",
      "SYSTEM_ROLE_MODIFY",
      "MANAGEMENT_ACCESS",
      ROLE_KEY_CONFLICT_ERROR,
      ROLE_KEY_EMPTY_ERROR,
    ]);
    const message = error instanceof Error ? error.message : "";
    return {
      success: false,
      code: (isUniqueConstraintError(error)
        ? ROLE_KEY_CONFLICT_ERROR
        : safeCodes.has(message)
          ? message
          : "SAVE_FAILED") as
        | "FORBIDDEN"
        | "ROLE_NOT_FOUND"
        | "SYSTEM_ROLE_MODIFY"
        | "MANAGEMENT_ACCESS"
        | "ROLE_KEY_CONFLICT"
        | "ROLE_KEY_EMPTY"
        | "SAVE_FAILED",
    };
  }
}

export async function deleteRole(roleId: string): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession(PERMISSIONS.ROLES_DELETE);
    if (!roleId) return { success: false, code: "INVALID_ROLE" };

    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ key: role.key, isSystem: role.isSystem })
        .from(role)
        .where(eq(role.id, roleId))
        .limit(1);
      if (!existing) throw new Error("ROLE_NOT_FOUND");
      if (existing.isSystem) throw new Error("SYSTEM_ROLE_DELETE");
      const [assignment] = await tx
        .select({ userId: userRole.userId })
        .from(userRole)
        .where(eq(userRole.roleId, roleId))
        .limit(1);
      if (assignment) throw new Error("ROLE_ASSIGNED");

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
    const safeCodes = new Set([
      "FORBIDDEN",
      "ROLE_NOT_FOUND",
      "SYSTEM_ROLE_DELETE",
      "ROLE_ASSIGNED",
    ]);
    const message = error instanceof Error ? error.message : "";
    return {
      success: false,
      code: (safeCodes.has(message) ? message : "DELETE_FAILED") as
        "FORBIDDEN" | "ROLE_NOT_FOUND" | "SYSTEM_ROLE_DELETE" | "ROLE_ASSIGNED" | "DELETE_FAILED",
    };
  }
}
