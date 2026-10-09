"use server";

import { revalidatePath } from "next/cache";

import { getCurrentSession } from "@/features/auth/server";
import type {
  OrganizationInvitationIdInput,
  OrganizationInvitationResponseResult,
} from "../interfaces/organization-invitation";
import {
  acceptOrganizationInvitation,
  rejectOrganizationInvitation,
} from "../lib/respond-to-organization-invitation";
import { organizationInvitationIdSchema } from "../schemas/organization-invitation-schema";

function failureCode(
  error: unknown
): OrganizationInvitationResponseResult extends { success: false; code: infer Code }
  ? Code
  : never {
  const known = new Set([
    "INVITATION_NOT_FOUND",
    "INVITATION_RECIPIENT_MISMATCH",
    "EMAIL_NOT_VERIFIED",
    "INVITATION_EXPIRED",
    "INVITATION_NOT_PENDING",
    "INVITATION_ROLE_INVALID",
    "ORGANIZATION_NOT_FOUND",
    "ORGANIZATION_RESTRICTED",
    "ALREADY_MEMBER",
    "ORGANIZATION_MEMBER_LIMIT_REACHED",
    "INVITATION_STATE_INVARIANT",
    "INVITATION_TRANSITION_CONFLICT",
    "UNAUTHORIZED",
  ]);
  const code = error instanceof Error ? error.message : "";
  return (
    known.has(code) ? code : "INVITATION_FAILED"
  ) as OrganizationInvitationResponseResult extends { success: false; code: infer Code }
    ? Code
    : never;
}

async function respond(
  input: OrganizationInvitationIdInput,
  accept: boolean
): Promise<OrganizationInvitationResponseResult> {
  const session = await getCurrentSession();
  if (!session) return { success: false, code: "UNAUTHORIZED" };
  const parsed = organizationInvitationIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, code: "VALIDATION_ERROR" };
  try {
    const result = accept
      ? await acceptOrganizationInvitation(parsed.data.invitationId, session.user.id)
      : await rejectOrganizationInvitation(parsed.data.invitationId, session.user.id);
    revalidatePath("/org");
    return { success: true, data: result };
  } catch (error) {
    return { success: false, code: failureCode(error) };
  }
}

export async function acceptOrganizationInvitationAction(
  input: OrganizationInvitationIdInput
): Promise<OrganizationInvitationResponseResult> {
  return respond(input, true);
}

export async function rejectOrganizationInvitationAction(
  input: OrganizationInvitationIdInput
): Promise<OrganizationInvitationResponseResult> {
  return respond(input, false);
}
