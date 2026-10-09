"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/drizzle";
import { member } from "@/db/schema";
import { getCurrentSession } from "@/features/auth/server";
import type { OrganizationMemberActor } from "../lib/manage-organization-members";
import { manageOrganizationMember } from "../lib/manage-organization-members";
import {
  manageOrganizationMemberSchema,
  removeOrganizationMemberSchema,
  transferOrganizationOwnershipSchema,
} from "../schemas/manage-organization-members-schema";

async function getActor(): Promise<OrganizationMemberActor | null> {
  const current = await getCurrentSession();
  const organizationId = current?.session.activeOrganizationId;
  if (!current || !organizationId) return null;
  const [activeMember] = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(
        eq(member.userId, current.user.id),
        eq(member.organizationId, organizationId),
        eq(member.status, "active")
      )
    )
    .limit(1);
  if (!activeMember) return null;
  return {
    userId: current.user.id,
    organizationId,
    membershipId: activeMember.id,
    name: current.user.name,
    email: current.user.email,
    username: current.user.username ?? null,
  };
}

function failure(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  const known = new Set([
    "FORBIDDEN",
    "NOT_FOUND",
    "LAST_ACTIVE_OWNER",
    "SELF_SUSPEND_FORBIDDEN",
    "INVALID_TRANSFER_RECIPIENT",
    "ORGANIZATION_MEMBER_LIMIT_REACHED",
    "LAST_ACTIVE_ADMIN",
    "MANAGING_MEMBERSHIP_REQUIRED",
  ]);
  return { success: false as const, code: known.has(code) ? code : "ORGANIZATION_FAILED" };
}

export async function updateOrganizationMemberAccess(input: unknown) {
  const actor = await getActor();
  if (!actor) return { success: false as const, code: "UNAUTHORIZED" };
  const parsed = manageOrganizationMemberSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, code: "VALIDATION_ERROR" };
  try {
    const data = await manageOrganizationMember(actor, { kind: "access", ...parsed.data });
    revalidatePath("/org/[organizationSlug]/members", "page");
    return { success: true as const, data };
  } catch (error) {
    return failure(error);
  }
}

export async function removeOrganizationMember(input: unknown) {
  const actor = await getActor();
  if (!actor) return { success: false as const, code: "UNAUTHORIZED" };
  const parsed = removeOrganizationMemberSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, code: "VALIDATION_ERROR" };
  try {
    const data = await manageOrganizationMember(actor, { kind: "remove", ...parsed.data });
    revalidatePath("/org/[organizationSlug]/members", "page");
    return { success: true as const, data };
  } catch (error) {
    return failure(error);
  }
}

export async function leaveOrganization() {
  const actor = await getActor();
  if (!actor) return { success: false as const, code: "UNAUTHORIZED" };
  try {
    const data = await manageOrganizationMember(actor, {
      kind: "remove",
      memberId: actor.membershipId,
    });
    revalidatePath("/org/[organizationSlug]/members", "page");
    return { success: true as const, data };
  } catch (error) {
    return failure(error);
  }
}

export async function transferOrganizationOwnership(input: unknown) {
  const actor = await getActor();
  if (!actor) return { success: false as const, code: "UNAUTHORIZED" };
  const parsed = transferOrganizationOwnershipSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, code: "VALIDATION_ERROR" };
  try {
    const data = await manageOrganizationMember(actor, { kind: "transfer", ...parsed.data });
    revalidatePath("/org/[organizationSlug]/members", "page");
    return { success: true as const, data };
  } catch (error) {
    return failure(error);
  }
}
