"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { db } from "@/db/drizzle";
import { member, organization } from "@/db/schema";
import { auth, getCurrentSession } from "@/features/auth/server";

const organizationIdSchema = z.string().trim().min(1);

export type SwitchOrganizationResult =
  { success: true; href: string } | { success: false; code: "FORBIDDEN" | "VALIDATION_ERROR" };

export async function switchOrganization(
  targetOrganizationId: string
): Promise<SwitchOrganizationResult> {
  const parsed = organizationIdSchema.safeParse(targetOrganizationId);
  if (!parsed.success) return { success: false, code: "VALIDATION_ERROR" };

  const current = await getCurrentSession();
  if (!current) return { success: false, code: "FORBIDDEN" };

  const [target] = await db
    .select({ id: organization.id, slug: organization.slug })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(
      and(
        eq(member.organizationId, parsed.data),
        eq(member.userId, current.user.id),
        eq(member.status, "active")
      )
    )
    .limit(1);

  if (!target) return { success: false, code: "FORBIDDEN" };

  if (current.session.activeOrganizationId !== target.id) {
    await auth.api.setActiveOrganization({
      body: { organizationId: target.id },
      headers: await headers(),
    });
  }

  return { success: true, href: `/org/${target.slug}` };
}
