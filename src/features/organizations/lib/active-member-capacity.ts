import "server-only";

import { and, count, eq } from "drizzle-orm";

import { member, organization } from "@/db/schema";
import { MAX_ACTIVE_MEMBERS_PER_ORGANIZATION } from "../constants/organization-limits";

type Executor = Pick<typeof import("@/db/drizzle").db, "select">;

export async function assertActiveMemberCapacity(executor: Executor, organizationId: string) {
  const [target] = await executor
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .for("update");
  if (!target) throw new Error("ORGANIZATION_NOT_FOUND");

  const [activeCount] = await executor
    .select({ count: count() })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.status, "active")));
  if (Number(activeCount?.count ?? 0) >= MAX_ACTIVE_MEMBERS_PER_ORGANIZATION) {
    throw new Error("ORGANIZATION_MEMBER_LIMIT_REACHED");
  }
}
