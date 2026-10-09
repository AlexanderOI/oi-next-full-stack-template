import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/db/drizzle";
import {
  allowlistGrant,
  authorizationAudit,
  invitation,
  member,
  membershipRole,
  organization,
  role,
  user,
} from "@/db/schema";
import { assertActiveMemberCapacity } from "./active-member-capacity";

const invitationDigest = (id: string) => createHash("sha256").update(id).digest("hex");
const normalizedEmail = (email: string) => email.trim().toLowerCase();

type Executor = typeof db;
type Identity = {
  id: string;
  email: string;
  emailVerified: boolean;
  disabledAt: Date | null;
  isOrganizationRestricted: boolean;
  managingOrganizationId: string | null;
  managingOrganizationIdSnapshot: string | null;
  allowlistFrozenAt: Date | null;
};

async function restrictedRecipientEligible(
  tx: Executor,
  identity: Identity,
  organizationId: string
) {
  if (!identity.isOrganizationRestricted) return true;
  if (identity.managingOrganizationId)
    return (
      identity.managingOrganizationId === organizationId ||
      Boolean(
        (
          await tx
            .select({ id: allowlistGrant.id })
            .from(allowlistGrant)
            .where(
              and(
                eq(allowlistGrant.subjectUserId, identity.id),
                eq(allowlistGrant.grantingOrganizationId, identity.managingOrganizationId),
                eq(allowlistGrant.allowedOrganizationId, organizationId)
              )
            )
            .limit(1)
        )[0]
      )
    );
  if (!identity.allowlistFrozenAt || !identity.managingOrganizationIdSnapshot) return false;
  const [frozenGrant] = await tx
    .select({ id: allowlistGrant.id })
    .from(allowlistGrant)
    .where(
      and(
        eq(allowlistGrant.subjectUserId, identity.id),
        isNull(allowlistGrant.grantingOrganizationId),
        eq(allowlistGrant.grantingOrganizationIdSnapshot, identity.managingOrganizationIdSnapshot),
        eq(allowlistGrant.allowedOrganizationId, organizationId)
      )
    )
    .limit(1);
  return Boolean(frozenGrant);
}

async function writeInvitationAudit(
  tx: Executor,
  organizationId: string,
  actorUserId: string,
  invitationId: string,
  action: "organization.invitation.accept" | "organization.invitation.reject"
) {
  const [target] = await tx
    .select({ slug: organization.slug, name: organization.name })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);
  await tx.insert(authorizationAudit).values({
    id: randomBytes(24).toString("base64url"),
    organizationId,
    organizationIdSnapshot: organizationId,
    organizationSlugSnapshot: target?.slug ?? null,
    organizationNameSnapshot: target?.name ?? null,
    actorUserId,
    actorMembershipId: null,
    action,
    targetType: "invitation",
    targetId: invitationDigest(invitationId),
    outcome: "success",
    metadata: {},
  });
}

function fail(code: string): never {
  throw new Error(code);
}

export async function acceptOrganizationInvitation(invitationId: string, recipientUserId: string) {
  return db.transaction(
    async (rawTx) => {
      // SAFETY: Drizzle transaction and database select builders have identical query semantics.
      const tx = rawTx as unknown as Executor;
      const [targetInvitation] = await tx
        .select({
          id: invitation.id,
          organizationId: invitation.organizationId,
          email: invitation.email,
          roleId: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
        })
        .from(invitation)
        .where(eq(invitation.id, invitationId))
        .for("update");
      if (!targetInvitation) return fail("INVITATION_NOT_FOUND");

      const [identity] = await tx
        .select({
          id: user.id,
          email: user.email,
          emailVerified: user.emailVerified,
          disabledAt: user.disabledAt,
          isOrganizationRestricted: user.isOrganizationRestricted,
          managingOrganizationId: user.managingOrganizationId,
          managingOrganizationIdSnapshot: user.managingOrganizationIdSnapshot,
          allowlistFrozenAt: user.allowlistFrozenAt,
        })
        .from(user)
        .where(eq(user.id, recipientUserId))
        .for("update");
      if (!identity || identity.disabledAt) return fail("UNAUTHORIZED");
      if (!identity.emailVerified) return fail("EMAIL_NOT_VERIFIED");
      if (normalizedEmail(identity.email) !== normalizedEmail(targetInvitation.email)) {
        return fail("INVITATION_RECIPIENT_MISMATCH");
      }

      const [targetOrganization] = await tx
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.id, targetInvitation.organizationId))
        .limit(1);
      if (!targetOrganization) return fail("ORGANIZATION_NOT_FOUND");

      const [storedRole] = await tx
        .select({
          id: role.id,
          scope: role.scope,
          organizationId: role.organizationId,
          isProtected: role.isProtected,
        })
        .from(role)
        .where(eq(role.id, targetInvitation.roleId))
        .limit(1);
      const validRole =
        storedRole?.scope === "organization" &&
        (storedRole.isProtected
          ? storedRole.organizationId === null
          : storedRole.organizationId === targetInvitation.organizationId);
      if (!validRole) return fail("INVITATION_ROLE_INVALID");

      const [existingMembership] = await tx
        .select({ id: member.id, role: member.role, status: member.status })
        .from(member)
        .where(
          and(
            eq(member.organizationId, targetInvitation.organizationId),
            eq(member.userId, recipientUserId)
          )
        )
        .limit(1);

      if (targetInvitation.status === "accepted") {
        if (
          !existingMembership ||
          existingMembership.role !== "member" ||
          existingMembership.status !== "active"
        )
          return fail("INVITATION_STATE_INVARIANT");
        const [assignment] = await tx
          .select({ roleId: membershipRole.roleId })
          .from(membershipRole)
          .where(
            and(
              eq(membershipRole.membershipId, existingMembership.id),
              eq(membershipRole.roleId, targetInvitation.roleId)
            )
          )
          .limit(1);
        if (!assignment) return fail("INVITATION_STATE_INVARIANT");
        return { changed: false, invitationId };
      }
      if (targetInvitation.status !== "pending") return fail("INVITATION_NOT_PENDING");
      if (targetInvitation.expiresAt.getTime() <= Date.now()) return fail("INVITATION_EXPIRED");
      if (existingMembership) return fail("INVITATION_STATE_INVARIANT");
      if (
        !(await restrictedRecipientEligible(
          tx,
          identity as Identity,
          targetInvitation.organizationId
        ))
      ) {
        return fail("ORGANIZATION_RESTRICTED");
      }

      await assertActiveMemberCapacity(tx, targetInvitation.organizationId);

      const membershipId = randomBytes(24).toString("base64url");
      await tx.insert(member).values({
        id: membershipId,
        organizationId: targetInvitation.organizationId,
        userId: recipientUserId,
        role: "member",
        status: "active",
      });
      await tx.insert(membershipRole).values({
        membershipId,
        roleId: targetInvitation.roleId,
        assignedByMembershipId: null,
      });
      const [transitioned] = await tx
        .update(invitation)
        .set({ status: "accepted" })
        .where(
          and(
            eq(invitation.id, invitationId),
            eq(invitation.status, "pending"),
            gt(invitation.expiresAt, new Date())
          )
        )
        .returning({ id: invitation.id });
      if (!transitioned) return fail("INVITATION_TRANSITION_CONFLICT");
      await writeInvitationAudit(
        tx,
        targetInvitation.organizationId,
        recipientUserId,
        invitationId,
        "organization.invitation.accept"
      );
      return { changed: true, invitationId };
    },
    { isolationLevel: "serializable" }
  );
}

export async function rejectOrganizationInvitation(invitationId: string, recipientUserId: string) {
  return db.transaction(
    async (rawTx) => {
      // SAFETY: Drizzle transaction and database select builders have identical query semantics.
      const tx = rawTx as unknown as Executor;
      const [targetInvitation] = await tx
        .select({
          id: invitation.id,
          organizationId: invitation.organizationId,
          email: invitation.email,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
        })
        .from(invitation)
        .where(eq(invitation.id, invitationId))
        .for("update");
      if (!targetInvitation) return fail("INVITATION_NOT_FOUND");
      const [identity] = await tx
        .select({ id: user.id, email: user.email, disabledAt: user.disabledAt })
        .from(user)
        .where(eq(user.id, recipientUserId))
        .limit(1);
      if (!identity || identity.disabledAt) return fail("UNAUTHORIZED");
      if (normalizedEmail(identity.email) !== normalizedEmail(targetInvitation.email))
        return fail("INVITATION_RECIPIENT_MISMATCH");
      if (targetInvitation.status !== "pending") return fail("INVITATION_NOT_PENDING");
      if (targetInvitation.expiresAt.getTime() <= Date.now()) return fail("INVITATION_EXPIRED");
      const [transitioned] = await tx
        .update(invitation)
        .set({ status: "rejected" })
        .where(
          and(
            eq(invitation.id, invitationId),
            eq(invitation.status, "pending"),
            gt(invitation.expiresAt, new Date())
          )
        )
        .returning({ id: invitation.id });
      if (!transitioned) return fail("INVITATION_TRANSITION_CONFLICT");
      await writeInvitationAudit(
        tx,
        targetInvitation.organizationId,
        recipientUserId,
        invitationId,
        "organization.invitation.reject"
      );
      return { changed: true, invitationId };
    },
    { isolationLevel: "serializable" }
  );
}
