"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/drizzle";
import { organization } from "@/db/schema";
import { getCurrentSession } from "@/features/auth/server";
import { deleteOrganization } from "../lib/delete-organization";
import { resolveOrganizationContext } from "../lib/resolve-organization-context";
import { deleteOrganizationSchema } from "../schemas/delete-organization-schema";

export async function deleteOrganizationAction(input: unknown) {
  const current = await getCurrentSession();
  const organizationId = current?.session.activeOrganizationId;
  if (!current || !organizationId) return { success: false as const, code: "UNAUTHORIZED" };

  const parsed = deleteOrganizationSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, code: "VALIDATION_ERROR" };
  const [activeOrganization] = await db
    .select({ slug: organization.slug })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);
  if (!activeOrganization)
    return { success: false as const, code: "ORGANIZATION_CONTEXT_INVALIDATED" };

  const context = await resolveOrganizationContext(activeOrganization.slug, {
    user: { id: current.user.id },
    session: {
      id: current.session.id,
      activeOrganizationId: organizationId,
    },
  });
  if (!context.ok) return { success: false as const, code: context.error };

  try {
    const data = await deleteOrganization(
      {
        userId: context.context.userId,
        membershipId: context.context.membershipId,
        organizationId: context.context.organizationId,
        organizationSlug: context.context.organizationSlug,
        organizationName: context.context.organizationName,
      },
      parsed.data.confirmation
    );
    revalidatePath("/org/[organizationSlug]", "page");
    revalidatePath("/org/[organizationSlug]/settings", "page");
    return { success: true as const, data };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const known = new Set([
      "FORBIDDEN",
      "NOT_FOUND",
      "CONFIRMATION_MISMATCH",
      "RESTRICTED_IDENTITY_INVARIANT",
    ]);
    return { success: false as const, code: known.has(code) ? code : "ORGANIZATION_DELETE_FAILED" };
  }
}
