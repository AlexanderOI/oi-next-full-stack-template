"use server";

import { and, eq } from "drizzle-orm";

import { db } from "@/db/drizzle";
import { member, organization, session as sessionTable } from "@/db/schema";
import { getCurrentSession } from "@/features/auth/server";

export type ClearInvalidOrganizationContextResult = {
  success: false;
  code: "ORGANIZATION_CONTEXT_INVALIDATED";
  href: "/org";
};

export async function clearInvalidOrganizationContext(): Promise<ClearInvalidOrganizationContextResult> {
  const current = await getCurrentSession();
  const observedOrganizationId = current?.session.activeOrganizationId;

  if (current && observedOrganizationId) {
    const [activeOrganization] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.id, observedOrganizationId))
      .limit(1);

    const [activeMembership] = activeOrganization
      ? await db
          .select({ id: member.id })
          .from(member)
          .where(
            and(
              eq(member.organizationId, observedOrganizationId),
              eq(member.userId, current.user.id),
              eq(member.status, "active")
            )
          )
          .limit(1)
      : [];

    if (!activeOrganization || !activeMembership) {
      await db
        .update(sessionTable)
        .set({ activeOrganizationId: null })
        .where(
          and(
            eq(sessionTable.id, current.session.id),
            eq(sessionTable.userId, current.user.id),
            eq(sessionTable.activeOrganizationId, observedOrganizationId)
          )
        );
    }
  }

  return {
    success: false,
    code: "ORGANIZATION_CONTEXT_INVALIDATED",
    href: "/org",
  };
}
