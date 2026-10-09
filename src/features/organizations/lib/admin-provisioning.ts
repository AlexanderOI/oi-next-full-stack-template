import "server-only";

import { randomBytes } from "node:crypto";

import { and, eq, isNotNull, or } from "drizzle-orm";

import { db } from "@/db/drizzle";
import {
  authorizationAudit,
  member,
  membershipRole,
  organization,
  permission,
  role,
  rolePermission,
  user,
} from "@/db/schema";
import { PERMISSIONS } from "@/features/authorization/server";
import {
  auth,
  createTrustedInvitationRequest,
  requestInvitationPasswordReset,
} from "@/features/auth/server";
import type { OrganizationProvisioningInput } from "../interfaces/admin-provisioning";
import { compensateFailedTrustedSignup } from "./complete-public-signup";
import { assertActiveMemberCapacity } from "./active-member-capacity";

const resetRedirect = "/auth/reset-password";

function errorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  if ("code" in error && typeof error.code === "string") return error.code;
  if ("body" in error) return errorCode(error.body);
  if ("cause" in error) return errorCode(error.cause);
  return null;
}

function hasPermission(rows: Array<{ permissionKey: string | null }>, restricted: boolean) {
  const keys = new Set(rows.map((row) => row.permissionKey));
  return (
    keys.has(PERMISSIONS.ORGANIZATION_MEMBERS_PROVISION) &&
    (!restricted || keys.has(PERMISSIONS.ORGANIZATION_RESTRICTIONS_CREATE))
  );
}

async function permissionRows(executor: typeof db, userId: string, organizationId: string) {
  return executor
    .select({ permissionKey: permission.key })
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
        or(eq(role.isProtected, true), eq(role.organizationId, organizationId)),
        eq(permission.scope, "organization")
      )
    );
}

export async function hasOrganizationProvisionPermission(
  actorId: string,
  organizationId: string,
  restricted: boolean
) {
  const rows = await permissionRows(db, actorId, organizationId);
  return hasPermission(rows, restricted);
}

export async function findProvisioningConflict(email: string, username: string) {
  const [existing] = await db
    .select({ email: user.email, username: user.username })
    .from(user)
    .where(or(eq(user.email, email), eq(user.username, username)))
    .limit(1);
  if (existing?.email === email) return "DUPLICATE_EMAIL" as const;
  if (existing?.username === username) return "DUPLICATE_USERNAME" as const;
  return null;
}

export async function verifyProvisionedIdentity(identity: {
  id: string;
  email: string;
  username: string;
}) {
  const [persisted] = await db
    .select({ id: user.id })
    .from(user)
    .where(
      and(
        eq(user.id, identity.id),
        eq(user.email, identity.email),
        eq(user.username, identity.username)
      )
    )
    .limit(1);
  if (persisted) return null;
  return (
    (await findProvisioningConflict(identity.email, identity.username)) ?? "PROVISIONING_FAILED"
  );
}

export async function createProvisionedIdentity(input: OrganizationProvisioningInput) {
  try {
    const result = await auth.api.signUpEmail({
      body: {
        name: input.name,
        email: input.email,
        username: input.username,
        password: randomBytes(32).toString("base64url"),
      },
      request: createTrustedInvitationRequest("http://localhost/api/auth/sign-up/email"),
    });
    return result.user;
  } catch (error) {
    const code = errorCode(error);
    if (code === "USERNAME_IS_ALREADY_TAKEN") return { conflict: "DUPLICATE_USERNAME" as const };
    if (code === "FAILED_TO_CREATE_USER" || code === "23505") {
      const conflict = await findProvisioningConflict(input.email, input.username);
      if (conflict) return { conflict };
    }
    throw error;
  }
}

export async function commitOrganizationProvisioning(args: {
  actorId: string;
  actorMembershipId: string;
  organizationId: string;
  userId: string;
  input: OrganizationProvisioningInput;
}) {
  const { actorId, actorMembershipId, organizationId, userId, input } = args;
  await db.transaction(
    async (tx) => {
      // SAFETY: Transaction and database select builders have identical query semantics; only the database client field differs.
      const permissions = await permissionRows(tx as unknown as typeof db, actorId, organizationId);
      const [actorMembership] = await tx
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.id, actorMembershipId),
            eq(member.userId, actorId),
            eq(member.organizationId, organizationId),
            eq(member.status, "active")
          )
        )
        .limit(1);
      if (!actorMembership || !hasPermission(permissions, input.restricted)) {
        throw new Error("PROVISIONING_AUTHORITY_REVOKED");
      }

      const [activeOrganization] = await tx
        .select({ id: organization.id, slug: organization.slug, name: organization.name })
        .from(organization)
        .where(eq(organization.id, organizationId))
        .limit(1);
      if (!activeOrganization) throw new Error("PROVISIONING_ORGANIZATION_MISSING");

      const [memberRole] = await tx
        .select({ id: role.id })
        .from(role)
        .where(
          and(
            eq(role.id, "system:organization:member"),
            eq(role.key, "member"),
            eq(role.scope, "organization"),
            eq(role.isProtected, true)
          )
        )
        .limit(1);
      if (!memberRole) throw new Error("PROVISIONING_MEMBER_ROLE_NOT_BOOTSTRAPPED");

      // SAFETY: Transaction and database select builders have identical query semantics; only the client field differs.
      await assertActiveMemberCapacity(tx as unknown as typeof db, organizationId);

      const membershipId = randomBytes(24).toString("base64url");
      await tx.insert(member).values({
        id: membershipId,
        organizationId,
        userId,
        role: "member",
        status: "active",
      });
      await tx.insert(membershipRole).values({
        membershipId,
        roleId: memberRole.id,
        assignedByMembershipId: actorMembership.id,
      });

      const userValues = input.restricted
        ? {
            invitedAt: new Date(),
            locale: input.locale,
            initialActiveOrganizationId: organizationId,
            isOrganizationRestricted: true,
            managingOrganizationId: organizationId,
            managingOrganizationIdSnapshot: organizationId,
            managingOrganizationSlugSnapshot: activeOrganization.slug,
            managingOrganizationNameSnapshot: activeOrganization.name,
          }
        : {
            invitedAt: new Date(),
            locale: input.locale,
            initialActiveOrganizationId: organizationId,
            isOrganizationRestricted: false,
            managingOrganizationId: null,
            managingOrganizationIdSnapshot: null,
            managingOrganizationSlugSnapshot: null,
            managingOrganizationNameSnapshot: null,
            allowlistFrozenAt: null,
          };
      await tx.update(user).set(userValues).where(eq(user.id, userId));

      if (input.restricted) {
        await tx.insert(authorizationAudit).values({
          id: randomBytes(24).toString("base64url"),
          organizationId,
          organizationIdSnapshot: organizationId,
          organizationSlugSnapshot: activeOrganization.slug,
          organizationNameSnapshot: activeOrganization.name,
          actorUserId: actorId,
          actorMembershipId,
          action: "organization.member.provision.restricted",
          targetType: "user",
          targetId: userId,
          outcome: "success",
          reasonCode: "ADMIN_PROVISIONED_RESTRICTED",
          metadata: { membershipId },
        });
      }
    },
    { isolationLevel: "serializable" }
  );
}

export async function deliverProvisioningActivation(email: string) {
  await requestInvitationPasswordReset(email, resetRedirect);
}

export async function findPendingOrganizationMember(userId: string, organizationId: string) {
  const [pending] = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .innerJoin(member, eq(user.id, member.userId))
    .where(
      and(
        eq(user.id, userId),
        eq(member.organizationId, organizationId),
        eq(member.status, "active"),
        isNotNull(user.invitedAt)
      )
    )
    .limit(1);
  return pending;
}

export { compensateFailedTrustedSignup };
