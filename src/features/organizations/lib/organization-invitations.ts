import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { and, eq, or } from "drizzle-orm";

import { db } from "@/db/drizzle";
import {
  allowlistGrant,
  authorizationAudit,
  invitation,
  member,
  membershipRole,
  organization,
  permission,
  role,
  rolePermission,
  user,
} from "@/db/schema";
import { PERMISSIONS } from "@/features/authorization/server";
import { deliverOrganizationInvitation } from "../email/organization-invitation-email";

const invitationLifetimeMs = 2 * 24 * 60 * 60 * 1000;
const requestedPermissions = [
  PERMISSIONS.ORGANIZATION_INVITATIONS_CREATE,
  PERMISSIONS.ORGANIZATION_MEMBER_ROLES_UPDATE,
] as const;

export interface InvitationActor {
  userId: string;
  organizationId: string;
  membershipId: string;
}

export interface OrganizationInvitationRecord {
  id: string;
  email: string;
  role: string;
  expiresAt: Date;
  organizationName: string;
  roleName: string;
}

export async function deliverInvitationEmail(record: OrganizationInvitationRecord) {
  return deliverOrganizationInvitation(record);
}

function uniqueViolation(error: unknown) {
  if (!error || typeof error !== "object") return false;
  if ("code" in error && error.code === "23505") return true;
  if ("cause" in error) return uniqueViolation(error.cause);
  return false;
}

export function invitationAuditTarget(id: string) {
  return createHash("sha256").update(id).digest("hex");
}

export function createInvitationTransitionPolicy(input: {
  pendingInvitationId: string | null;
  expectedInvitationId?: string;
  explicitReplacement: boolean;
  canResend: boolean;
  transitionedRows?: number;
}): "CREATE" | "REPLACE" | "RACE" | "NOT_PENDING" | "FORBIDDEN" {
  if (input.expectedInvitationId && input.pendingInvitationId !== input.expectedInvitationId) {
    return "NOT_PENDING";
  }
  if (!input.pendingInvitationId) return input.expectedInvitationId ? "NOT_PENDING" : "CREATE";
  if (!input.canResend) return "FORBIDDEN";
  if (!input.explicitReplacement) return "RACE";
  if (input.transitionedRows === 0) return "RACE";
  return "REPLACE";
}

export function roleNeedsOwnershipTransfer(roleCandidate: { isProtected: boolean; key: string }) {
  return roleCandidate.isProtected && roleCandidate.key === "owner";
}

export async function hasInvitationPermission(
  actor: InvitationActor,
  permissions: readonly string[],
  executor: typeof db = db
) {
  const rows = await executor
    .select({ permissionKey: permission.key })
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
  const granted = new Set(rows.map((row) => row.permissionKey));
  return permissions.every((key) => granted.has(key));
}

async function roleForInvitation(executor: typeof db, organizationId: string, roleId: string) {
  const [candidate] = await executor
    .select({
      id: role.id,
      key: role.key,
      name: role.name,
      scope: role.scope,
      organizationId: role.organizationId,
      isProtected: role.isProtected,
    })
    .from(role)
    .where(eq(role.id, roleId))
    .limit(1);

  if (
    !candidate ||
    candidate.scope !== "organization" ||
    (!candidate.isProtected && candidate.organizationId !== organizationId) ||
    (candidate.isProtected && candidate.organizationId !== null)
  ) {
    return null;
  }
  return candidate;
}

export function recipientEligibilityPolicy(input: {
  identityExists: boolean;
  isOrganizationRestricted?: boolean;
  managingOrganizationId?: string | null;
  organizationId: string;
  isMember: boolean;
  hasExplicitGrant: boolean;
}): "eligible" | "member" | "restricted" {
  if (!input.identityExists) return "eligible";
  if (input.isMember) return "member";
  if (!input.isOrganizationRestricted || input.managingOrganizationId === input.organizationId) {
    return "eligible";
  }
  return input.hasExplicitGrant ? "eligible" : "restricted";
}

async function recipientEligibility(
  executor: typeof db,
  email: string,
  organizationId: string
): Promise<"eligible" | "member" | "restricted"> {
  const [identity] = await executor
    .select({
      id: user.id,
      isOrganizationRestricted: user.isOrganizationRestricted,
      managingOrganizationId: user.managingOrganizationId,
    })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  if (!identity) {
    return recipientEligibilityPolicy({
      identityExists: false,
      organizationId,
      isMember: false,
      hasExplicitGrant: false,
    });
  }

  const [existingMember] = await executor
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, identity.id), eq(member.organizationId, organizationId)))
    .limit(1);
  if (existingMember) {
    return recipientEligibilityPolicy({
      identityExists: true,
      organizationId,
      isMember: true,
      hasExplicitGrant: false,
    });
  }
  if (!identity.isOrganizationRestricted || identity.managingOrganizationId === organizationId) {
    return recipientEligibilityPolicy({
      identityExists: true,
      isOrganizationRestricted: identity.isOrganizationRestricted,
      managingOrganizationId: identity.managingOrganizationId,
      organizationId,
      isMember: false,
      hasExplicitGrant: false,
    });
  }

  const [grant] = await executor
    .select({ id: allowlistGrant.id })
    .from(allowlistGrant)
    .where(
      and(
        eq(allowlistGrant.subjectUserId, identity.id),
        eq(allowlistGrant.allowedOrganizationId, organizationId)
      )
    )
    .limit(1);
  return recipientEligibilityPolicy({
    identityExists: true,
    isOrganizationRestricted: identity.isOrganizationRestricted,
    managingOrganizationId: identity.managingOrganizationId,
    organizationId,
    isMember: false,
    hasExplicitGrant: Boolean(grant),
  });
}

async function auditInvitation(
  executor: typeof db,
  actor: InvitationActor,
  action: string,
  id: string,
  roleId: string
) {
  const [org] = await executor
    .select({ slug: organization.slug, name: organization.name })
    .from(organization)
    .where(eq(organization.id, actor.organizationId))
    .limit(1);
  await executor.insert(authorizationAudit).values({
    id: randomBytes(24).toString("base64url"),
    organizationId: actor.organizationId,
    organizationIdSnapshot: actor.organizationId,
    organizationSlugSnapshot: org?.slug ?? null,
    organizationNameSnapshot: org?.name ?? null,
    actorUserId: actor.userId,
    actorMembershipId: actor.membershipId,
    action,
    targetType: "invitation",
    targetId: invitationAuditTarget(id),
    outcome: "success",
    metadata: { roleId },
  });
}

export async function findPendingByEmail(organizationId: string, email: string) {
  const [row] = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      organizationName: organization.name,
      roleName: role.name,
    })
    .from(invitation)
    .innerJoin(organization, eq(invitation.organizationId, organization.id))
    .innerJoin(role, eq(invitation.role, role.id))
    .where(
      and(
        eq(invitation.organizationId, organizationId),
        eq(invitation.email, email),
        eq(invitation.status, "pending")
      )
    )
    .limit(1);
  return row ?? null;
}

export async function findPendingInvitation(organizationId: string, invitationId: string) {
  const [row] = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    })
    .from(invitation)
    .where(
      and(
        eq(invitation.id, invitationId),
        eq(invitation.organizationId, organizationId),
        eq(invitation.status, "pending")
      )
    )
    .limit(1);
  return row ?? null;
}

export async function createOrReplaceInvitation(
  actor: InvitationActor,
  email: string,
  roleId: string,
  explicitReplacement: boolean,
  expectedInvitationId?: string
): Promise<OrganizationInvitationRecord | "ALREADY_MEMBER" | "FORBIDDEN" | "RACE" | "NOT_PENDING"> {
  try {
    return await db.transaction(async (tx) => {
      // SAFETY: Drizzle transaction and database select builders have identical query semantics.
      const roleCandidate = await roleForInvitation(
        tx as unknown as typeof db,
        actor.organizationId,
        roleId
      );
      if (!roleCandidate) return "FORBIDDEN";
      const needed: string[] = [...requestedPermissions];
      if (roleNeedsOwnershipTransfer(roleCandidate)) {
        needed.push(PERMISSIONS.ORGANIZATION_OWNERSHIP_TRANSFER);
      }
      const permissionRows = await tx
        .select({ permissionKey: permission.key })
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
      const granted = new Set(permissionRows.map((row) => row.permissionKey));
      if (!needed.every((item) => granted.has(item))) return "FORBIDDEN";
      if (explicitReplacement && !granted.has(PERMISSIONS.ORGANIZATION_INVITATIONS_RESEND)) {
        return "FORBIDDEN";
      }

      // SAFETY: Drizzle transaction and database select builders have identical query semantics.
      const eligibility = await recipientEligibility(
        tx as unknown as typeof db,
        email,
        actor.organizationId
      );
      if (eligibility === "member") return "ALREADY_MEMBER";
      if (eligibility === "restricted") return "FORBIDDEN";

      const [existing] = await tx
        .select({ id: invitation.id, status: invitation.status })
        .from(invitation)
        .where(
          and(
            eq(invitation.organizationId, actor.organizationId),
            eq(invitation.email, email),
            eq(invitation.status, "pending")
          )
        )
        .limit(1)
        .for("update");
      const transition = createInvitationTransitionPolicy({
        pendingInvitationId: existing?.id ?? null,
        expectedInvitationId,
        explicitReplacement,
        canResend: granted.has(PERMISSIONS.ORGANIZATION_INVITATIONS_RESEND),
      });
      if (transition === "NOT_PENDING") return "NOT_PENDING";
      if (transition === "FORBIDDEN") return "FORBIDDEN";
      if (transition === "RACE") return "RACE";

      if (existing) {
        const transitioned = await tx
          .update(invitation)
          .set({ status: "canceled" })
          .where(and(eq(invitation.id, existing.id), eq(invitation.status, "pending")))
          .returning({ id: invitation.id });
        const afterTransition = createInvitationTransitionPolicy({
          pendingInvitationId: existing.id,
          expectedInvitationId: existing.id,
          explicitReplacement: true,
          canResend: true,
          transitionedRows: transitioned.length,
        });
        if (afterTransition !== "REPLACE") return "RACE";
      }

      const id = randomBytes(32).toString("base64url");
      const now = new Date();
      const expiresAt = new Date(now.getTime() + invitationLifetimeMs);
      const [org] = await tx
        .select({ name: organization.name })
        .from(organization)
        .where(eq(organization.id, actor.organizationId))
        .limit(1);
      await tx.insert(invitation).values({
        id,
        organizationId: actor.organizationId,
        email,
        role: roleCandidate.id,
        status: "pending",
        expiresAt,
        inviterId: actor.userId,
      });
      // SAFETY: Drizzle transaction and database select builders have identical query semantics.
      await auditInvitation(
        tx as unknown as typeof db,
        actor,
        existing ? "organization.invitation.replace" : "organization.invitation.create",
        id,
        roleCandidate.id
      );
      return {
        id,
        email,
        role: roleCandidate.id,
        expiresAt,
        organizationName: org?.name ?? "Your organization",
        roleName: roleCandidate.name,
      };
    });
  } catch (error) {
    if (uniqueViolation(error)) return "RACE";
    throw error;
  }
}

export async function cancelInvitation(actor: InvitationActor, invitationId: string) {
  return db.transaction(async (tx) => {
    // SAFETY: Drizzle transaction and database select builders have identical query semantics.
    const allowed = await hasInvitationPermission(
      actor,
      [PERMISSIONS.ORGANIZATION_INVITATIONS_CANCEL],
      tx as unknown as typeof db
    );
    if (!allowed) return "FORBIDDEN" as const;
    const [target] = await tx
      .select({ id: invitation.id, role: invitation.role })
      .from(invitation)
      .where(
        and(
          eq(invitation.id, invitationId),
          eq(invitation.organizationId, actor.organizationId),
          eq(invitation.status, "pending")
        )
      )
      .limit(1);
    if (!target) return "NOT_PENDING" as const;
    const transitioned = await tx
      .update(invitation)
      .set({ status: "canceled" })
      .where(and(eq(invitation.id, target.id), eq(invitation.status, "pending")))
      .returning({ id: invitation.id });
    if (transitioned.length === 0) return "NOT_PENDING" as const;
    // SAFETY: Drizzle transaction and database select builders have identical query semantics.
    await auditInvitation(
      tx as unknown as typeof db,
      actor,
      "organization.invitation.cancel",
      target.id,
      target.role
    );
    return "CANCELED" as const;
  });
}

export async function resendInvitation(actor: InvitationActor, invitationId: string) {
  const target = await findPendingInvitation(actor.organizationId, invitationId);
  if (!target) return "NOT_PENDING" as const;
  const [roleCandidate] = await db
    .select({ id: role.id, key: role.key, isProtected: role.isProtected })
    .from(role)
    .where(eq(role.id, target.role))
    .limit(1);
  if (!roleCandidate) return "NOT_PENDING" as const;
  const replacement = await createOrReplaceInvitation(
    actor,
    target.email,
    target.role,
    true,
    invitationId
  );
  if (typeof replacement === "string") return replacement;
  return replacement;
}
