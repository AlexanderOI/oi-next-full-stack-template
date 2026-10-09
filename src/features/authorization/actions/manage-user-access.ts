"use server";

import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/drizzle";
import {
  authorizationAudit,
  member,
  permission,
  role,
  rolePermission,
  session,
  platformRoleAssignment,
  user,
} from "@/db/schema";
import { PERMISSIONS } from "../constants/permissions";
import type { PermissionKey } from "../interfaces/permission";
import type { UserAccessResult, UserAccessStatus } from "../interfaces/user-access-result";
import { evaluatePermissions } from "../lib/authorization-policy";
import { type UserAccessInput, userAccessInputSchema } from "../schemas/user-access-input-schema";
import { requireAuthorizedSession } from "../server";

const managementPermissions = [
  PERMISSIONS.USER_ACCESS_UPDATE,
  PERMISSIONS.USER_ROLES_UPDATE,
] as const;

interface ManagementPermissionRow {
  userId: string;
  permissionKey: PermissionKey;
}

function preservesManagementContinuity(
  targetUserId: string,
  rows: readonly ManagementPermissionRow[]
) {
  const targetPermissions = rows
    .filter((row) => row.userId === targetUserId)
    .map((row) => row.permissionKey);
  if (!evaluatePermissions(targetPermissions, managementPermissions, "any")) return true;

  return managementPermissions.every(
    (permissionKey) =>
      !evaluatePermissions(targetPermissions, [permissionKey], "all") ||
      rows.some((row) => row.userId !== targetUserId && row.permissionKey === permissionKey)
  );
}

function accessStatus(disabledAt: Date | null): UserAccessStatus {
  return disabledAt ? "disabled" : "active";
}

export async function updateUserAccess(input: UserAccessInput): Promise<UserAccessResult> {
  try {
    const actorSession = await requireAuthorizedSession(PERMISSIONS.USER_ACCESS_UPDATE);
    const parsed = userAccessInputSchema.safeParse(input);
    if (!parsed.success) return { success: false, code: "VALIDATION_ERROR" };

    const outcome = await db.transaction(
      async (tx) => {
        const [target] = await tx
          .select({
            id: user.id,
            disabledAt: user.disabledAt,
            invitedAt: user.invitedAt,
            initialActiveOrganizationId: user.initialActiveOrganizationId,
          })
          .from(user)
          .where(eq(user.id, parsed.data.userId))
          .limit(1);
        if (!target) throw new Error("USER_NOT_FOUND");
        if (target.invitedAt) throw new Error("INVITATION_PENDING");
        if (parsed.data.status === "disabled" && target.id === actorSession.user.id) {
          throw new Error("SELF_DISABLE_FORBIDDEN");
        }

        const currentStatus = accessStatus(target.disabledAt);
        if (currentStatus === parsed.data.status) {
          return { userId: target.id, status: currentStatus, changed: false };
        }

        if (parsed.data.status === "disabled") {
          const managementRows = await tx
            .select({ userId: user.id, permissionKey: permission.key })
            .from(user)
            .innerJoin(platformRoleAssignment, eq(user.id, platformRoleAssignment.userId))
            .innerJoin(role, eq(platformRoleAssignment.roleId, role.id))
            .innerJoin(rolePermission, eq(role.id, rolePermission.roleId))
            .innerJoin(permission, eq(rolePermission.permissionKey, permission.key))
            .where(
              and(
                isNull(user.disabledAt),
                isNull(user.invitedAt),
                eq(role.scope, "platform"),
                eq(permission.scope, "platform"),
                inArray(permission.key, managementPermissions)
              )
            );

          if (
            !preservesManagementContinuity(target.id, managementRows as ManagementPermissionRow[])
          ) {
            throw new Error("LAST_ACTIVE_MANAGER");
          }

          await tx.update(user).set({ disabledAt: new Date() }).where(eq(user.id, target.id));
          await tx.delete(session).where(eq(session.userId, target.id));
        } else {
          const [validPath] = await tx
            .select({ id: member.id })
            .from(member)
            .where(
              and(
                eq(member.userId, target.id),
                target.initialActiveOrganizationId
                  ? or(
                      eq(member.status, "active"),
                      and(
                        eq(member.organizationId, target.initialActiveOrganizationId),
                        eq(member.status, "suspended")
                      )
                    )
                  : eq(member.status, "active")
              )
            )
            .limit(1);
          if (!validPath) throw new Error("NO_VALID_REACTIVATION_PATH");
          await tx.update(user).set({ disabledAt: null }).where(eq(user.id, target.id));
        }

        await tx.insert(authorizationAudit).values({
          id: crypto.randomUUID(),
          actorUserId: actorSession.user.id,
          action:
            parsed.data.status === "disabled" ? "user.access-disabled" : "user.access-reactivated",
          targetType: "user",
          targetId: target.id,
          metadata: { status: parsed.data.status },
        });

        return { userId: target.id, status: parsed.data.status, changed: true };
      },
      { isolationLevel: "serializable" }
    );

    if (outcome.changed) revalidatePath("/admin/users");
    return { success: true, data: outcome };
  } catch (error) {
    const safeCodes = new Set([
      "FORBIDDEN",
      "USER_NOT_FOUND",
      "SELF_DISABLE_FORBIDDEN",
      "LAST_ACTIVE_MANAGER",
      "INVITATION_PENDING",
    ]);
    const message = error instanceof Error ? error.message : "";
    if (message === "Unauthorized") return { success: false, code: "UNAUTHORIZED" };

    return {
      success: false,
      code: safeCodes.has(message)
        ? (message as
            | "FORBIDDEN"
            | "USER_NOT_FOUND"
            | "SELF_DISABLE_FORBIDDEN"
            | "LAST_ACTIVE_MANAGER"
            | "INVITATION_PENDING")
        : "ACCESS_UPDATE_FAILED",
    };
  }
}
