import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db/drizzle";
import { member, organization } from "@/db/schema";
import type { OrganizationContextResult } from "../interfaces/organization-context-result";
import type { OrganizationSessionContext } from "../interfaces/organization-session-context";
import { normalizeOrganizationSlug } from "../utils/normalize-organization-slug";

export async function resolveOrganizationContext(
  organizationSlug: string,
  current: OrganizationSessionContext | null
): Promise<OrganizationContextResult> {
  if (!current) return { ok: false, error: "FORBIDDEN" };

  const activeOrganizationId = current.session.activeOrganizationId;
  let activeOrganization: { id: string; slug: string; name: string } | undefined;
  let activeMembership: { id: string } | undefined;
  if (activeOrganizationId) {
    [activeOrganization] = await db
      .select({ id: organization.id, slug: organization.slug, name: organization.name })
      .from(organization)
      .where(eq(organization.id, activeOrganizationId))
      .limit(1);

    if (!activeOrganization) {
      return { ok: false, error: "ORGANIZATION_CONTEXT_INVALIDATED" };
    }

    [activeMembership] = await db
      .select({ id: member.id })
      .from(member)
      .where(
        and(
          eq(member.organizationId, activeOrganization.id),
          eq(member.userId, current.user.id),
          eq(member.status, "active")
        )
      )
      .limit(1);

    if (!activeMembership) {
      return { ok: false, error: "ORGANIZATION_CONTEXT_INVALIDATED" };
    }
  }

  const normalizedSlug = normalizeOrganizationSlug(organizationSlug);
  if (!normalizedSlug) return { ok: false, error: "NOT_FOUND" };

  const [targetOrganization] = await db
    .select({
      id: organization.id,
      slug: organization.slug,
      name: organization.name,
    })
    .from(organization)
    .where(eq(organization.slug, normalizedSlug))
    .limit(1);

  if (!targetOrganization) return { ok: false, error: "NOT_FOUND" };

  const [targetMembership] = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(
        eq(member.organizationId, targetOrganization.id),
        eq(member.userId, current.user.id),
        eq(member.status, "active")
      )
    )
    .limit(1);

  if (!targetMembership) return { ok: false, error: "NOT_FOUND" };

  const target = {
    organizationId: targetOrganization.id,
    organizationSlug: targetOrganization.slug,
    organizationName: targetOrganization.name,
    membershipId: targetMembership.id,
  };

  if (!activeOrganizationId) {
    return { ok: false, error: "ORGANIZATION_CONTEXT_REQUIRED", target };
  }

  if (targetOrganization.id !== activeOrganizationId) {
    return {
      ok: false,
      error: "ORGANIZATION_CONTEXT_MISMATCH",
      target,
      active: {
        organizationId: activeOrganizationId,
        organizationSlug: activeOrganization!.slug,
        organizationName: activeOrganization!.name,
        membershipId: activeMembership!.id,
      },
    };
  }

  return {
    ok: true,
    context: {
      userId: current.user.id,
      sessionId: current.session.id,
      organizationId: targetOrganization.id,
      organizationSlug: targetOrganization.slug,
      organizationName: targetOrganization.name,
      membershipId: targetMembership.id,
    },
  };
}
