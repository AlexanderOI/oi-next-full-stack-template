import "server-only";

import { and, count, eq, isNull, or } from "drizzle-orm";

import { db } from "@/db/drizzle";
import {
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
import type { OrganizationMemberRemovalResult } from "../interfaces/organization-result";
import { assertActiveMemberCapacity } from "./active-member-capacity";

type Executor = Pick<typeof db, "select" | "update" | "insert" | "delete">;

export interface OrganizationMemberActor {
  userId: string;
  membershipId: string;
  organizationId: string;
  name?: string;
  email?: string;
  username?: string | null;
}

export type OrganizationMemberMutation =
  | { kind: "access"; memberId: string; status: "active" | "suspended" }
  | { kind: "transfer"; recipientMemberId: string }
  | { kind: "remove"; memberId: string };

async function permissionKeys(executor: Executor, actor: OrganizationMemberActor) {
  const rows = await executor
    .select({ key: permission.key })
    .from(member)
    .innerJoin(membershipRole, eq(member.id, membershipRole.membershipId))
    .innerJoin(role, eq(membershipRole.roleId, role.id))
    .innerJoin(rolePermission, eq(role.id, rolePermission.roleId))
    .innerJoin(permission, eq(rolePermission.permissionKey, permission.key))
    .where(
      and(
        eq(member.id, actor.membershipId),
        eq(member.userId, actor.userId),
        eq(member.organizationId, actor.organizationId),
        eq(member.status, "active"),
        eq(role.scope, "organization"),
        or(eq(role.isProtected, true), eq(role.organizationId, actor.organizationId)),
        eq(permission.scope, "organization")
      )
    );
  return new Set(rows.map(({ key }) => key));
}

async function requireOrganization(executor: Executor, organizationId: string) {
  const [row] = await executor
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .for("update");
  if (!row) throw new Error("NOT_FOUND");
}

async function audit(
  executor: Executor,
  actor: OrganizationMemberActor,
  action: string,
  targetId: string,
  metadata: Record<string, unknown>
) {
  await executor.insert(authorizationAudit).values({
    id: crypto.randomUUID(),
    organizationId: actor.organizationId,
    actorUserId: actor.userId,
    actorMembershipId: actor.membershipId,
    action,
    targetType: "organization-member",
    targetId,
    reasonCode: action,
    metadata,
  });
}

async function updateAccess(
  executor: Executor,
  actor: OrganizationMemberActor,
  input: Extract<OrganizationMemberMutation, { kind: "access" }>
) {
  await requireOrganization(executor, actor.organizationId);
  const permissions = await permissionKeys(executor, actor);
  if (!permissions.has(PERMISSIONS.ORGANIZATION_MEMBER_ACCESS_UPDATE)) {
    throw new Error("FORBIDDEN");
  }

  const [target] = await executor
    .select({
      id: member.id,
      userId: member.userId,
      status: member.status,
      disabledAt: user.disabledAt,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(and(eq(member.id, input.memberId), eq(member.organizationId, actor.organizationId)))
    .for("update");
  if (!target) throw new Error("NOT_FOUND");
  if (target.status === input.status) {
    return {
      memberId: target.id,
      status: input.status,
      changed: false,
      identityDisabled: Boolean(target.disabledAt),
    };
  }

  if (input.status === "suspended") {
    if (target.userId === actor.userId) throw new Error("SELF_SUSPEND_FORBIDDEN");
    const [activeMemberships] = await executor
      .select({ total: count() })
      .from(member)
      .where(and(eq(member.userId, target.userId), eq(member.status, "active")));
    const isSoleActiveMembership = Number(activeMemberships?.total ?? 0) === 1;

    const ownerRows = await executor
      .select({ membershipId: membershipRole.membershipId })
      .from(membershipRole)
      .innerJoin(role, eq(membershipRole.roleId, role.id))
      .innerJoin(member, eq(membershipRole.membershipId, member.id))
      .where(
        and(
          eq(member.organizationId, actor.organizationId),
          eq(member.status, "active"),
          eq(role.scope, "organization"),
          eq(role.key, "owner"),
          eq(role.isProtected, true)
        )
      );
    if (ownerRows.length <= 1 && ownerRows[0]?.membershipId === target.id) {
      throw new Error("LAST_ACTIVE_OWNER");
    }

    const now = new Date();
    await executor
      .update(member)
      .set({
        status: "suspended",
        suspendedAt: now,
        suspendedByUserId: actor.userId,
      })
      .where(and(eq(member.id, target.id), eq(member.organizationId, actor.organizationId)));
    if (isSoleActiveMembership) {
      await executor.update(user).set({ disabledAt: now }).where(eq(user.id, target.userId));
      await executor.delete(session).where(eq(session.userId, target.userId));
    } else {
      await executor
        .update(session)
        .set({ activeOrganizationId: null })
        .where(
          and(
            eq(session.userId, target.userId),
            eq(session.activeOrganizationId, actor.organizationId)
          )
        );
    }
    await audit(executor, actor, "organization.member-suspended", target.id, {
      memberId: target.id,
      userId: target.userId,
      reason: "organization.members.access.update",
      globalIdentityDisabled: isSoleActiveMembership,
    });
    return {
      memberId: target.id,
      status: "suspended" as const,
      changed: true,
      identityDisabled: isSoleActiveMembership,
    };
  }

  await assertActiveMemberCapacity(executor, actor.organizationId);
  await executor
    .update(member)
    .set({ status: "active", suspendedAt: null, suspendedByUserId: null })
    .where(and(eq(member.id, target.id), eq(member.organizationId, actor.organizationId)));
  await audit(executor, actor, "organization.member-reactivated", target.id, {
    memberId: target.id,
    userId: target.userId,
    reason: "organization.members.access.update",
    identityRemainsDisabled: Boolean(target.disabledAt),
  });
  return {
    memberId: target.id,
    status: "active" as const,
    changed: true,
    identityDisabled: Boolean(target.disabledAt),
  };
}

async function removeMember(
  executor: Executor,
  actor: OrganizationMemberActor,
  memberId: string
): Promise<OrganizationMemberRemovalResult> {
  await requireOrganization(executor, actor.organizationId);
  const [target] = await executor
    .select({
      id: member.id,
      userId: member.userId,
      status: member.status,
      name: user.name,
      email: user.email,
      username: user.username,
      isOrganizationRestricted: user.isOrganizationRestricted,
      managingOrganizationId: user.managingOrganizationId,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(and(eq(member.id, memberId), eq(member.organizationId, actor.organizationId)))
    .for("update");
  if (!target) throw new Error("NOT_FOUND");

  const isSelf = target.id === actor.membershipId && target.userId === actor.userId;
  if (isSelf) {
    if (target.status !== "active") throw new Error("FORBIDDEN");
  } else {
    const permissions = await permissionKeys(executor, actor);
    if (!permissions.has(PERMISSIONS.ORGANIZATION_MEMBERS_REMOVE)) throw new Error("FORBIDDEN");
  }

  const ownerRows = await executor
    .select({ membershipId: membershipRole.membershipId })
    .from(membershipRole)
    .innerJoin(role, eq(membershipRole.roleId, role.id))
    .innerJoin(member, eq(membershipRole.membershipId, member.id))
    .where(
      and(
        eq(member.organizationId, actor.organizationId),
        eq(member.status, "active"),
        eq(role.scope, "organization"),
        eq(role.key, "owner"),
        eq(role.isProtected, true)
      )
    );
  if (ownerRows.length <= 1 && ownerRows[0]?.membershipId === target.id) {
    throw new Error("LAST_ACTIVE_OWNER");
  }

  const adminRows = await executor
    .select({ membershipId: membershipRole.membershipId })
    .from(membershipRole)
    .innerJoin(role, eq(membershipRole.roleId, role.id))
    .innerJoin(member, eq(membershipRole.membershipId, member.id))
    .where(
      and(
        eq(member.organizationId, actor.organizationId),
        eq(member.status, "active"),
        eq(role.scope, "organization"),
        or(eq(role.key, "admin"), eq(role.key, "owner")),
        eq(role.isProtected, true)
      )
    );
  const administratorMembershipIds = new Set(adminRows.map(({ membershipId }) => membershipId));
  if (administratorMembershipIds.size <= 1 && administratorMembershipIds.has(target.id)) {
    throw new Error("LAST_ACTIVE_ADMIN");
  }

  const [allMemberships] = await executor
    .select({ total: count() })
    .from(member)
    .where(eq(member.userId, target.userId));
  const membershipCount = Number(allMemberships?.total ?? 0);
  const hasOtherMembership = membershipCount > 1;
  if (
    target.isOrganizationRestricted &&
    target.managingOrganizationId === actor.organizationId &&
    hasOtherMembership
  ) {
    throw new Error("MANAGING_MEMBERSHIP_REQUIRED");
  }

  const targetSnapshot = {
    membershipId: target.id,
    userId: target.userId,
    name: target.name,
    email: target.email,
    username: target.username,
    status: target.status,
  };
  const identityDeleted = !hasOtherMembership;
  await audit(executor, actor, "organization.member-removed", target.id, {
    actorSnapshot: {
      userId: actor.userId,
      name: actor.name ?? null,
      email: actor.email ?? null,
      username: actor.username ?? null,
      membershipId: actor.membershipId,
      organizationId: actor.organizationId,
    },
    targetSnapshot,
    identityDeleted,
    ...(identityDeleted ? { authoredInvitationsRevokedByCascade: true } : {}),
  });

  await executor.delete(membershipRole).where(eq(membershipRole.membershipId, target.id));
  await executor
    .delete(member)
    .where(and(eq(member.id, target.id), eq(member.organizationId, actor.organizationId)));
  if (identityDeleted) {
    await executor.delete(user).where(eq(user.id, target.userId));
  } else {
    await executor
      .update(session)
      .set({ activeOrganizationId: null })
      .where(
        and(
          eq(session.userId, target.userId),
          eq(session.activeOrganizationId, actor.organizationId)
        )
      );
  }
  return { memberId: target.id, changed: true as const, identityDeleted };
}

async function transferOwnership(
  executor: Executor,
  actor: OrganizationMemberActor,
  recipientMemberId: string
) {
  await requireOrganization(executor, actor.organizationId);
  const permissions = await permissionKeys(executor, actor);
  if (!permissions.has(PERMISSIONS.ORGANIZATION_OWNERSHIP_TRANSFER)) {
    throw new Error("FORBIDDEN");
  }

  const [source] = await executor
    .select({ id: member.id })
    .from(member)
    .where(
      and(
        eq(member.id, actor.membershipId),
        eq(member.userId, actor.userId),
        eq(member.organizationId, actor.organizationId),
        eq(member.status, "active")
      )
    )
    .for("update");
  if (!source) throw new Error("FORBIDDEN");
  const [sourceOwner] = await executor
    .select({ roleId: role.id })
    .from(membershipRole)
    .innerJoin(role, eq(membershipRole.roleId, role.id))
    .where(
      and(
        eq(membershipRole.membershipId, source.id),
        eq(role.key, "owner"),
        eq(role.isProtected, true)
      )
    )
    .limit(1);
  if (!sourceOwner) throw new Error("FORBIDDEN");

  const [recipient] = await executor
    .select({ id: member.id, userId: member.userId, disabledAt: user.disabledAt })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(
      and(
        eq(member.id, recipientMemberId),
        eq(member.organizationId, actor.organizationId),
        eq(member.status, "active")
      )
    )
    .for("update");
  if (!recipient || recipient.id === source.id || recipient.disabledAt) {
    throw new Error("INVALID_TRANSFER_RECIPIENT");
  }

  const [ownerRole] = await executor
    .select({ id: role.id })
    .from(role)
    .where(
      and(
        eq(role.key, "owner"),
        eq(role.scope, "organization"),
        eq(role.isProtected, true),
        isNull(role.organizationId)
      )
    )
    .limit(1);
  const [adminRole] = await executor
    .select({ id: role.id })
    .from(role)
    .where(
      and(
        eq(role.key, "admin"),
        eq(role.scope, "organization"),
        eq(role.isProtected, true),
        isNull(role.organizationId)
      )
    )
    .limit(1);
  if (!ownerRole || !adminRole) throw new Error("ROLE_CONFIGURATION_INVALID");

  await executor
    .insert(membershipRole)
    .values({
      membershipId: recipient.id,
      roleId: ownerRole.id,
      assignedByMembershipId: source.id,
    })
    .onConflictDoNothing();
  await executor.update(member).set({ role: "owner" }).where(eq(member.id, recipient.id));
  await executor
    .delete(membershipRole)
    .where(
      and(eq(membershipRole.membershipId, source.id), eq(membershipRole.roleId, ownerRole.id))
    );
  await executor
    .insert(membershipRole)
    .values({
      membershipId: source.id,
      roleId: adminRole.id,
      assignedByMembershipId: source.id,
    })
    .onConflictDoNothing();
  await executor.update(member).set({ role: "admin" }).where(eq(member.id, source.id));
  await audit(executor, actor, "organization.ownership-transferred", source.id, {
    sourceMemberId: source.id,
    recipientMemberId: recipient.id,
    sourceUserId: actor.userId,
    recipientUserId: recipient.userId,
    reason: "organization.ownership.transfer",
  });
  return {
    sourceMemberId: source.id,
    recipientMemberId: recipient.id,
    changed: true as const,
  };
}

export async function manageOrganizationMember(
  actor: OrganizationMemberActor,
  input: OrganizationMemberMutation
) {
  return db.transaction(
    async (tx) =>
      input.kind === "access"
        ? updateAccess(tx, actor, input)
        : input.kind === "transfer"
          ? transferOwnership(tx, actor, input.recipientMemberId)
          : removeMember(tx, actor, input.memberId),
    { isolationLevel: "serializable" }
  );
}
