import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db/drizzle";
import { member, organization } from "@/db/schema";
import type { ActiveOrganizationOption } from "../interfaces/active-organization-option";

export async function listActiveOrganizations(userId: string): Promise<ActiveOrganizationOption[]> {
  return db
    .select({ id: organization.id, slug: organization.slug, name: organization.name })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(and(eq(member.userId, userId), eq(member.status, "active")))
    .orderBy(organization.name);
}
