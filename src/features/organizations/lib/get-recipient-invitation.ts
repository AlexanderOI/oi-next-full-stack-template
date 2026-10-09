import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db/drizzle";
import { invitation, member, organization, role, user } from "@/db/schema";
import type {
  RecipientInvitationStatus,
  RecipientInvitationView,
} from "../interfaces/recipient-invitation";

interface SessionLike {
  user: { id: string };
  session: { activeOrganizationId?: string | null };
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function getRecipientInvitation(
  invitationId: string,
  session: SessionLike | null,
  now = new Date()
): Promise<RecipientInvitationView> {
  if (!session) return { state: "sign-in-required" };

  const [identity] = await db
    .select({
      email: user.email,
      emailVerified: user.emailVerified,
      disabledAt: user.disabledAt,
    })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);
  if (!identity || identity.disabledAt) return { state: "unavailable" };

  const [recipientInvitation] = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      organizationId: invitation.organizationId,
      roleId: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
    })
    .from(invitation)
    .where(eq(invitation.id, invitationId))
    .limit(1);
  if (
    !recipientInvitation ||
    normalizeEmail(identity.email) !== normalizeEmail(recipientInvitation.email)
  ) {
    return { state: "unavailable" };
  }

  if (!identity.emailVerified) {
    return {
      state: "verify-email",
      canReject: recipientInvitation.status === "pending" && recipientInvitation.expiresAt > now,
    };
  }

  const [details] = await db
    .select({
      organizationName: organization.name,
      organizationSlug: organization.slug,
      roleName: role.name,
      roleScope: role.scope,
      roleOrganizationId: role.organizationId,
      roleIsProtected: role.isProtected,
    })
    .from(organization)
    .innerJoin(role, eq(role.id, recipientInvitation.roleId))
    .where(eq(organization.id, recipientInvitation.organizationId))
    .limit(1);
  if (
    !details ||
    details.roleScope !== "organization" ||
    (details.roleIsProtected
      ? details.roleOrganizationId !== null
      : details.roleOrganizationId !== recipientInvitation.organizationId)
  ) {
    return { state: "unavailable" };
  }

  let status: RecipientInvitationStatus;
  if (recipientInvitation.status === "pending") {
    status = recipientInvitation.expiresAt <= now ? "expired" : "pending";
  } else if (
    recipientInvitation.status === "accepted" ||
    recipientInvitation.status === "rejected" ||
    recipientInvitation.status === "canceled"
  ) {
    status = recipientInvitation.status;
  } else {
    return { state: "unavailable" };
  }
  const canRespond = status === "pending";
  let showSwitch = false;
  let activeOrganizationName: string | null = null;

  if (status === "accepted") {
    const [targetMembership] = await db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(
        and(
          eq(member.organizationId, recipientInvitation.organizationId),
          eq(member.userId, session.user.id),
          eq(member.status, "active")
        )
      )
      .limit(1);
    showSwitch =
      Boolean(targetMembership) &&
      session.session.activeOrganizationId !== recipientInvitation.organizationId;

    if (showSwitch && session.session.activeOrganizationId) {
      const [activeOrganization] = await db
        .select({ name: organization.name })
        .from(organization)
        .where(eq(organization.id, session.session.activeOrganizationId))
        .limit(1);
      activeOrganizationName = activeOrganization?.name ?? null;
    }
  }

  return {
    state: "invitation",
    email: identity.email,
    status,
    expiresAt: recipientInvitation.expiresAt.toISOString(),
    organizationId: recipientInvitation.organizationId,
    organizationName: details.organizationName,
    organizationSlug: details.organizationSlug,
    roleName: details.roleName,
    canAccept: canRespond,
    canReject: canRespond,
    showSwitch,
    activeOrganizationName,
  };
}
