import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db/drizzle";
import {
  allowlistGrant,
  authorizationAudit,
  member,
  membershipRole,
  organization,
  permission,
  role,
  rolePermission,
  session,
  user,
} from "@/db/schema";
import { PERMISSIONS } from "@/features/authorization/server";
import type { OrganizationDeletionResult } from "../interfaces/organization-result";

export interface OrganizationDeletionActor {
  userId: string;
  membershipId: string;
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
}

interface AffectedMember {
  membershipId: string;
  userId: string;
  status: string;
  name: string;
  email: string;
  username: string | null;
  disabledAt: Date | null;
  isOrganizationRestricted: boolean;
  managingOrganizationId: string | null;
  managingOrganizationIdSnapshot: string | null;
  managingOrganizationSlugSnapshot: string | null;
  managingOrganizationNameSnapshot: string | null;
  allowlistFrozenAt: Date | null;
}

interface RemainingMember {
  id: string;
  userId: string;
  organizationId: string;
  status: string;
}

interface GrantSnapshot {
  id: string;
  subjectUserId: string;
  grantingOrganizationId: string | null;
  grantingOrganizationIdSnapshot: string;
  grantingOrganizationSlugSnapshot: string;
  grantingOrganizationNameSnapshot: string;
  allowedOrganizationId: string;
  grantedByUserIdSnapshot: string;
}

export async function getOrganizationDeletionAvailability(userId: string, organizationId: string) {
  const rows = await db
    .select({ roleKey: role.key, isProtected: role.isProtected, permissionKey: permission.key })
    .from(member)
    .innerJoin(membershipRole, eq(member.id, membershipRole.membershipId))
    .innerJoin(role, eq(membershipRole.roleId, role.id))
    .innerJoin(rolePermission, eq(role.id, rolePermission.roleId))
    .innerJoin(permission, eq(rolePermission.permissionKey, permission.key))
    .where(
      and(
        eq(member.userId, userId),
        eq(member.organizationId, organizationId),
        eq(member.status, "active"),
        eq(role.scope, "organization"),
        eq(permission.scope, "organization")
      )
    );
  return (
    rows.some(({ roleKey, isProtected }) => roleKey === "owner" && isProtected) &&
    rows.some(({ permissionKey }) => permissionKey === PERMISSIONS.ORGANIZATION_DELETE)
  );
}

export async function clearDeletedOrganizationSessionContext(
  organizationId: string,
  survivingUserIds: string[]
) {
  if (survivingUserIds.length === 0) return;
  await db
    .update(session)
    .set({ activeOrganizationId: null })
    .where(
      and(
        eq(session.activeOrganizationId, organizationId),
        inArray(session.userId, survivingUserIds)
      )
    );
}

export async function deleteOrganization(
  actor: OrganizationDeletionActor,
  confirmation: string
): Promise<OrganizationDeletionResult> {
  const result = await db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: organization.id, slug: organization.slug, name: organization.name })
      .from(organization)
      .where(eq(organization.id, actor.organizationId))
      .for("update");
    if (!target) throw new Error("NOT_FOUND");
    if (confirmation !== target.slug) throw new Error("CONFIRMATION_MISMATCH");

    const actorRows = await tx
      .select({
        membershipId: member.id,
        userId: member.userId,
        status: member.status,
        roleKey: role.key,
        isProtected: role.isProtected,
        permissionKey: permission.key,
      })
      .from(member)
      .innerJoin(membershipRole, eq(member.id, membershipRole.membershipId))
      .innerJoin(role, eq(membershipRole.roleId, role.id))
      .innerJoin(rolePermission, eq(role.id, rolePermission.roleId))
      .innerJoin(permission, eq(rolePermission.permissionKey, permission.key))
      .where(
        and(
          eq(member.id, actor.membershipId),
          eq(member.userId, actor.userId),
          eq(member.organizationId, target.id),
          eq(member.status, "active"),
          eq(role.scope, "organization"),
          eq(permission.scope, "organization")
        )
      )
      .for("update");
    const isOwner = actorRows.some((row) => row.roleKey === "owner" && row.isProtected);
    const canDelete = actorRows.some(
      (row) => row.permissionKey === PERMISSIONS.ORGANIZATION_DELETE
    );
    if (!isOwner || !canDelete) throw new Error("FORBIDDEN");

    const affected = (await tx
      .select({
        membershipId: member.id,
        userId: user.id,
        status: member.status,
        name: user.name,
        email: user.email,
        username: user.username,
        disabledAt: user.disabledAt,
        isOrganizationRestricted: user.isOrganizationRestricted,
        managingOrganizationId: user.managingOrganizationId,
        managingOrganizationIdSnapshot: user.managingOrganizationIdSnapshot,
        managingOrganizationSlugSnapshot: user.managingOrganizationSlugSnapshot,
        managingOrganizationNameSnapshot: user.managingOrganizationNameSnapshot,
        allowlistFrozenAt: user.allowlistFrozenAt,
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, target.id))
      .for("update")) as AffectedMember[];
    const userIds = [...new Set(affected.map(({ userId }) => userId))];
    let remaining: RemainingMember[] = [];
    let grants: GrantSnapshot[] = [];
    if (userIds.length > 0) {
      remaining = (await tx
        .select({
          id: member.id,
          userId: member.userId,
          organizationId: member.organizationId,
          status: member.status,
        })
        .from(member)
        .where(inArray(member.userId, userIds))
        .for("update")) as RemainingMember[];
      grants = (await tx
        .select({
          id: allowlistGrant.id,
          subjectUserId: allowlistGrant.subjectUserId,
          grantingOrganizationId: allowlistGrant.grantingOrganizationId,
          grantingOrganizationIdSnapshot: allowlistGrant.grantingOrganizationIdSnapshot,
          grantingOrganizationSlugSnapshot: allowlistGrant.grantingOrganizationSlugSnapshot,
          grantingOrganizationNameSnapshot: allowlistGrant.grantingOrganizationNameSnapshot,
          allowedOrganizationId: allowlistGrant.allowedOrganizationId,
          grantedByUserIdSnapshot: allowlistGrant.grantedByUserIdSnapshot,
        })
        .from(allowlistGrant)
        .where(inArray(allowlistGrant.subjectUserId, userIds))
        .for("update")) as GrantSnapshot[];
    }

    const deletedUserIds: string[] = [];
    const survivingUserIds: string[] = [];
    const frozenAt = new Date();
    const byUser = new Map<string, AffectedMember>();
    for (const entry of affected) byUser.set(entry.userId, entry);
    for (const [userId, identity] of byUser) {
      const outside = remaining.filter(
        (membership) => membership.userId === userId && membership.organizationId !== target.id
      );
      if (outside.length === 0) {
        deletedUserIds.push(userId);
        continue;
      }
      survivingUserIds.push(userId);
      if (identity.isOrganizationRestricted && identity.managingOrganizationId === target.id) {
        if (identity.allowlistFrozenAt) throw new Error("RESTRICTED_IDENTITY_INVARIANT");
        const permitted = grants
          .filter((grant) => grant.subjectUserId === userId)
          .map(({ allowedOrganizationId }) => allowedOrganizationId);
        if (outside.some(({ organizationId }) => !permitted.includes(organizationId))) {
          throw new Error("RESTRICTED_IDENTITY_INVARIANT");
        }
        // The organization FK becomes null on deletion; the snapshot and grants remain immutable.
        await tx
          .update(user)
          .set({ managingOrganizationId: null, allowlistFrozenAt: frozenAt })
          .where(eq(user.id, userId));
      } else if (
        identity.isOrganizationRestricted &&
        outside.some(
          ({ organizationId }) =>
            organizationId !== identity.managingOrganizationId &&
            !grants.some(
              (grant) =>
                grant.subjectUserId === userId && grant.allowedOrganizationId === organizationId
            )
        )
      ) {
        throw new Error("RESTRICTED_IDENTITY_INVARIANT");
      }
    }

    const affectedUserSnapshots = affected.map((entry) => ({
      userId: entry.userId,
      membershipId: entry.membershipId,
      status: entry.status,
      name: entry.name,
      email: entry.email,
      username: entry.username,
      disabledAt: entry.disabledAt?.toISOString() ?? null,
      restricted: entry.isOrganizationRestricted,
      managingOrganizationId: entry.managingOrganizationId,
      managingOrganizationIdSnapshot: entry.managingOrganizationIdSnapshot,
      managingOrganizationSlugSnapshot: entry.managingOrganizationSlugSnapshot,
      managingOrganizationNameSnapshot: entry.managingOrganizationNameSnapshot,
      allowlistFrozenAt: entry.allowlistFrozenAt?.toISOString() ?? null,
      grants: grants.filter((grant) => grant.subjectUserId === entry.userId),
    }));
    await tx.insert(authorizationAudit).values({
      id: crypto.randomUUID(),
      organizationId: target.id,
      organizationIdSnapshot: target.id,
      organizationSlugSnapshot: target.slug,
      organizationNameSnapshot: target.name,
      actorUserId: actor.userId,
      actorMembershipId: actor.membershipId,
      action: "organization.deleted",
      targetType: "organization",
      targetId: target.id,
      reasonCode: "organization.delete",
      metadata: {
        organization: { id: target.id, slug: target.slug, name: target.name },
        actor: {
          userId: actor.userId,
          membershipId: actor.membershipId,
          name: affected.find(({ userId }) => userId === actor.userId)?.name ?? null,
          email: affected.find(({ userId }) => userId === actor.userId)?.email ?? null,
          username: affected.find(({ userId }) => userId === actor.userId)?.username ?? null,
          role: actorRows.find(({ roleKey }) => roleKey === "owner")?.roleKey ?? null,
        },
        affectedUsers: affectedUserSnapshots,
      },
    });

    if (deletedUserIds.length > 0) {
      await tx.delete(user).where(inArray(user.id, deletedUserIds));
    }
    await tx.delete(organization).where(eq(organization.id, target.id));
    return { organizationId: target.id, deletedUserIds, survivingUserIds };
  });

  let sessionCleanupPending = false;
  if (result.survivingUserIds.length > 0) {
    try {
      await clearDeletedOrganizationSessionContext(result.organizationId, result.survivingUserIds);
    } catch {
      sessionCleanupPending = true;
    }
  }
  return { ...result, sessionCleanupPending };
}
