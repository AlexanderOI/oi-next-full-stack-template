"use server";

import { and, eq } from "drizzle-orm";

import { db } from "@/db/drizzle";
import { member } from "@/db/schema";
import { getCurrentSession } from "@/features/auth/server";
import { getFieldErrors } from "@/lib/utils";
import type {
  CreateOrganizationInvitationInput,
  OrganizationInvitationIdInput,
  OrganizationInvitationResult,
} from "../interfaces/organization-invitation";
import {
  cancelInvitation,
  createOrReplaceInvitation,
  deliverInvitationEmail,
  findPendingByEmail,
  findPendingInvitation,
  hasInvitationPermission,
  resendInvitation,
} from "../lib/organization-invitations";
import {
  createOrganizationInvitationSchema,
  organizationInvitationIdSchema,
} from "../schemas/organization-invitation-schema";

async function getActor() {
  const session = await getCurrentSession();
  const organizationId = session?.session.activeOrganizationId;
  if (!session || !organizationId) return null;
  const [activeMembership] = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(
        eq(member.userId, session.user.id),
        eq(member.organizationId, organizationId),
        eq(member.status, "active")
      )
    )
    .limit(1);
  if (!activeMembership) return null;
  return {
    userId: session.user.id,
    organizationId,
    membershipId: activeMembership.id,
  };
}

function asSuccess(record: { id: string; expiresAt: Date }): OrganizationInvitationResult {
  return {
    success: true,
    data: { invitationId: record.id, expiresAt: record.expiresAt.toISOString() },
  };
}

async function deliver(record: {
  id: string;
  email: string;
  role: string;
  expiresAt: Date;
  organizationName: string;
  roleName: string;
}): Promise<OrganizationInvitationResult> {
  try {
    await deliverInvitationEmail(record);
    return asSuccess(record);
  } catch {
    return {
      success: false,
      code: "INVITATION_DELIVERY_FAILED",
      invitationId: record.id,
      expiresAt: record.expiresAt.toISOString(),
    };
  }
}

export async function createOrganizationInvitation(
  input: CreateOrganizationInvitationInput
): Promise<OrganizationInvitationResult> {
  const actor = await getActor();
  if (!actor) return { success: false, code: "UNAUTHORIZED" };
  const basePermission = await hasInvitationPermission(actor, [
    "organization.invitations.create",
    "organization.member-roles.update",
  ]);
  if (!basePermission) return { success: false, code: "FORBIDDEN" };

  const parsed = createOrganizationInvitationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      code: "VALIDATION_ERROR",
      details: getFieldErrors(parsed.error),
    };
  }

  const pending = await findPendingByEmail(actor.organizationId, parsed.data.email);
  const canReplace = pending
    ? await hasInvitationPermission(actor, [
        "organization.invitations.create",
        "organization.member-roles.update",
        "organization.invitations.resend",
      ])
    : false;
  if (pending && !canReplace) return { success: false, code: "FORBIDDEN" };

  try {
    const record = await createOrReplaceInvitation(
      actor,
      parsed.data.email,
      parsed.data.roleId,
      Boolean(pending),
      pending?.id
    );
    if (record === "ALREADY_MEMBER") return { success: false, code: "ALREADY_MEMBER" };
    if (record === "FORBIDDEN") return { success: false, code: "FORBIDDEN" };
    if (record === "NOT_PENDING") return { success: false, code: "INVITATION_NOT_PENDING" };
    if (record === "RACE") {
      const current = await findPendingByEmail(actor.organizationId, parsed.data.email);
      return current ? asSuccess(current) : { success: false, code: "INVITATION_FAILED" };
    }
    return deliver(record);
  } catch {
    return { success: false, code: "INVITATION_FAILED" };
  }
}

export async function cancelOrganizationInvitation(
  input: OrganizationInvitationIdInput
): Promise<OrganizationInvitationResult> {
  const actor = await getActor();
  if (!actor) return { success: false, code: "UNAUTHORIZED" };
  const parsed = organizationInvitationIdSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      code: "VALIDATION_ERROR",
      details: getFieldErrors(parsed.error),
    };
  }
  try {
    const result = await cancelInvitation(actor, parsed.data.invitationId);
    if (result === "FORBIDDEN") return { success: false, code: "FORBIDDEN" };
    if (result === "NOT_PENDING") return { success: false, code: "INVITATION_NOT_PENDING" };
    return { success: true, data: { invitationId: parsed.data.invitationId } };
  } catch {
    return { success: false, code: "INVITATION_FAILED" };
  }
}

export async function resendOrganizationInvitation(
  input: OrganizationInvitationIdInput
): Promise<OrganizationInvitationResult> {
  const actor = await getActor();
  if (!actor) return { success: false, code: "UNAUTHORIZED" };
  const parsed = organizationInvitationIdSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      code: "VALIDATION_ERROR",
      details: getFieldErrors(parsed.error),
    };
  }
  const canResend = await hasInvitationPermission(actor, [
    "organization.invitations.create",
    "organization.member-roles.update",
    "organization.invitations.resend",
  ]);
  if (!canResend) return { success: false, code: "FORBIDDEN" };
  const target = await findPendingInvitation(actor.organizationId, parsed.data.invitationId);
  if (!target) return { success: false, code: "INVITATION_NOT_PENDING" };
  try {
    const replacement = await resendInvitation(actor, parsed.data.invitationId);
    if (replacement === "NOT_PENDING") return { success: false, code: "INVITATION_NOT_PENDING" };
    if (replacement === "ALREADY_MEMBER") return { success: false, code: "ALREADY_MEMBER" };
    if (replacement === "FORBIDDEN") return { success: false, code: "FORBIDDEN" };
    if (replacement === "RACE") {
      const current = await findPendingByEmail(actor.organizationId, target.email);
      return current ? asSuccess(current) : { success: false, code: "INVITATION_NOT_PENDING" };
    }
    return deliver(replacement);
  } catch {
    return { success: false, code: "INVITATION_FAILED" };
  }
}
