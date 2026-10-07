"use server";

import { revalidatePath } from "next/cache";
import { and, countDistinct, eq, inArray } from "drizzle-orm";

import { db } from "@/db/drizzle";
import { authorizationAudit, role, rolePermission, user, userRole } from "@/db/schema";
import { PERMISSIONS } from "../constants/permissions";
import type { ActionResult } from "../interfaces/action-result";
import { canReplaceUserRoles } from "../lib/authorization-policy";
import { type UserRolesInput, userRolesInputSchema } from "../schemas/user-roles-input-schema";
import { requireAuthorizedSession } from "../server";

export async function replaceUserRoles(input: UserRolesInput): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession(PERMISSIONS.USER_ROLES_UPDATE);
    const parsed = userRolesInputSchema.safeParse(input);
    if (!parsed.success) return { success: false, code: "INVALID_ASSIGNMENT" };

    await db.transaction(
      async (tx) => {
        const [target] = await tx
          .select({ id: user.id })
          .from(user)
          .where(eq(user.id, parsed.data.userId))
          .limit(1);
        if (!target) throw new Error("USER_NOT_FOUND");

        const selectedRoles = await tx
          .select({ id: role.id, key: role.key })
          .from(role)
          .where(inArray(role.id, parsed.data.roleIds));
        if (selectedRoles.length !== new Set(parsed.data.roleIds).size) {
          throw new Error("INVALID_ROLES");
        }

        const [adminRole] = await tx
          .select({ id: role.id })
          .from(role)
          .where(eq(role.key, "admin"))
          .limit(1);
        if (!adminRole) throw new Error("ADMIN_MISSING");

        const [targetAdmin] = await tx
          .select({ userId: userRole.userId })
          .from(userRole)
          .where(and(eq(userRole.userId, target.id), eq(userRole.roleId, adminRole.id)))
          .limit(1);
        const [{ value: adminCount }] = await tx
          .select({ value: countDistinct(userRole.userId) })
          .from(userRole)
          .where(eq(userRole.roleId, adminRole.id));

        const selectedRoleIds = new Set(parsed.data.roleIds);
        let actorKeepsAdministration = true;
        if (session.user.id === target.id) {
          const actorPermissionRows = await tx
            .select({ permissionKey: rolePermission.permissionKey })
            .from(rolePermission)
            .where(inArray(rolePermission.roleId, parsed.data.roleIds));
          const actorPermissions = new Set(actorPermissionRows.map((row) => row.permissionKey));
          actorKeepsAdministration = actorPermissions.has(PERMISSIONS.USER_ROLES_UPDATE);
        }

        if (
          !canReplaceUserRoles({
            actorUserId: session.user.id,
            targetUserId: target.id,
            actorKeepsAdministration,
            targetWasAdmin: Boolean(targetAdmin),
            targetWillBeAdmin: selectedRoleIds.has(adminRole.id),
            adminCount: Number(adminCount),
          })
        ) {
          throw new Error("ADMINISTRATIVE_ACCESS");
        }

        await tx.delete(userRole).where(eq(userRole.userId, target.id));
        await tx
          .insert(userRole)
          .values(parsed.data.roleIds.map((roleId) => ({ userId: target.id, roleId })));
        await tx.insert(authorizationAudit).values({
          id: crypto.randomUUID(),
          actorUserId: session.user.id,
          action: "user.roles-replaced",
          targetType: "user",
          targetId: target.id,
          metadata: { roleIds: [...selectedRoleIds].sort() },
        });
      },
      { isolationLevel: "serializable" }
    );

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    const safeCodes = new Set([
      "FORBIDDEN",
      "USER_NOT_FOUND",
      "INVALID_ROLES",
      "ADMIN_MISSING",
      "ADMINISTRATIVE_ACCESS",
    ]);
    const message = error instanceof Error ? error.message : "";
    if (message === "Unauthorized") return { success: false, code: "UNAUTHORIZED" };

    return {
      success: false,
      code: (safeCodes.has(message) ? message : "UPDATE_FAILED") as
        | "FORBIDDEN"
        | "USER_NOT_FOUND"
        | "INVALID_ROLES"
        | "ADMIN_MISSING"
        | "ADMINISTRATIVE_ACCESS"
        | "UPDATE_FAILED",
    };
  }
}
