"use server";

import { and, eq } from "drizzle-orm";

import { db } from "@/db/drizzle";
import { member } from "@/db/schema";
import { getCurrentSession } from "@/features/auth/server";
import { getFieldErrors } from "@/lib/utils";
import type {
  OrganizationProvisioningInput,
  OrganizationProvisioningResult,
} from "../interfaces/admin-provisioning";
import {
  commitOrganizationProvisioning,
  compensateFailedTrustedSignup,
  createProvisionedIdentity,
  deliverProvisioningActivation,
  findPendingOrganizationMember,
  findProvisioningConflict,
  verifyProvisionedIdentity,
  hasOrganizationProvisionPermission,
} from "../lib/admin-provisioning";
import { organizationProvisioningSchema } from "../schemas/admin-provisioning-schema";

async function currentAuthority(
  restricted: boolean
): Promise<
  | { error: "UNAUTHORIZED" | "FORBIDDEN" }
  | { actorId: string; organizationId: string; actorMembershipId: string }
> {
  const session = await getCurrentSession();
  const organizationId = session?.session.activeOrganizationId;
  if (!session || !organizationId) return { error: "UNAUTHORIZED" as const };

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
  if (!activeMembership) return { error: "FORBIDDEN" as const };
  if (!(await hasOrganizationProvisionPermission(session.user.id, organizationId, restricted))) {
    return { error: "FORBIDDEN" as const };
  }
  return { actorId: session.user.id, organizationId, actorMembershipId: activeMembership.id };
}

export async function provisionOrganizationMember(
  input: OrganizationProvisioningInput
): Promise<OrganizationProvisioningResult> {
  const authority = await currentAuthority(Boolean(input?.restricted));
  if ("error" in authority) return { success: false, code: authority.error };

  const parsed = organizationProvisioningSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, code: "VALIDATION_ERROR", details: getFieldErrors(parsed.error) };
  }
  const values = parsed.data;
  const conflict = await findProvisioningConflict(values.email, values.username);
  if (conflict) return { success: false, code: conflict };

  let identity: { id: string; email: string };
  try {
    const created = await createProvisionedIdentity(values);
    if ("conflict" in created) return { success: false, code: created.conflict };
    identity = created;
  } catch {
    return { success: false, code: "PROVISIONING_FAILED" };
  }

  try {
    const identityConflict = await verifyProvisionedIdentity({
      id: identity.id,
      email: values.email,
      username: values.username,
    });
    if (identityConflict) {
      try {
        await compensateFailedTrustedSignup(identity.id);
      } catch {
        return { success: false, code: "IDENTITY_COMPENSATION_FAILED" };
      }
      return { success: false, code: identityConflict };
    }
    await commitOrganizationProvisioning({ ...authority, userId: identity.id, input: values });
  } catch {
    try {
      await compensateFailedTrustedSignup(identity.id);
    } catch {
      return { success: false, code: "IDENTITY_COMPENSATION_FAILED" };
    }
    return { success: false, code: "PROVISIONING_FAILED" };
  }

  try {
    await deliverProvisioningActivation(identity.email);
  } catch {
    return {
      success: false,
      code: "INVITATION_DELIVERY_FAILED",
      pendingUserId: identity.id,
    };
  }
  return { success: true, data: { userId: identity.id } };
}

export async function resendOrganizationMemberActivation(
  userId: string
): Promise<OrganizationProvisioningResult> {
  const authority = await currentAuthority(false);
  if ("error" in authority) return { success: false, code: authority.error };
  const pending = await findPendingOrganizationMember(userId, authority.organizationId);
  if (!pending) return { success: false, code: "INVITATION_NOT_PENDING" };
  try {
    await deliverProvisioningActivation(pending.email);
  } catch {
    return {
      success: false,
      code: "INVITATION_DELIVERY_FAILED",
      pendingUserId: pending.id,
    };
  }
  return { success: true, data: { userId: pending.id } };
}
