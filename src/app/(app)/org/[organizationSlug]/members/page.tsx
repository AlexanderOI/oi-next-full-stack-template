import { notFound } from "next/navigation";

import { getCurrentSession } from "@/features/auth/server";
import { OrganizationMemberAdministration } from "@/features/organizations/client";
import {
  getOrganizationMemberPermissions,
  listOrganizationMembers,
} from "@/features/organizations/server";
import { resolveOrganizationContext } from "@/features/organizations/server";

interface Props {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export default async function OrganizationMembersPage({ params, searchParams }: Props) {
  const [{ organizationSlug }, query, current] = await Promise.all([
    params,
    searchParams,
    getCurrentSession(),
  ]);
  const session = current
    ? {
        user: { id: current.user.id },
        session: {
          id: current.session.id,
          activeOrganizationId: current.session.activeOrganizationId ?? null,
        },
      }
    : null;
  const resolved = await resolveOrganizationContext(organizationSlug, session);
  if (!resolved.ok) notFound();

  const permissions = await getOrganizationMemberPermissions(
    resolved.context.userId,
    resolved.context.organizationId
  );
  if (!permissions.canRead) notFound();

  const rawSort = first(query.sort);
  let sort = "name";
  let direction: "asc" | "desc" = "asc";
  if (rawSort) {
    try {
      const decoded: unknown = JSON.parse(rawSort);
      if (
        Array.isArray(decoded) &&
        decoded[0] &&
        typeof decoded[0].id === "string" &&
        typeof decoded[0].desc === "boolean"
      ) {
        sort = decoded[0].id;
        direction = decoded[0].desc ? "desc" : "asc";
      }
    } catch {
      // Invalid URL sorting falls back to the stable default.
    }
  }
  const data = await listOrganizationMembers({
    organizationId: resolved.context.organizationId,
    page: positiveInteger(first(query.page), 1),
    pageSize: positiveInteger(first(query.perPage), 20),
    search: first(query.search) ?? "",
    includeIdentityDisabled: permissions.canManageAccess,
    sort,
    direction,
  });
  return (
    <OrganizationMemberAdministration
      data={data}
      canProvision={permissions.canProvision}
      canCreateRestriction={permissions.canCreateRestriction}
      canManageAccess={permissions.canManageAccess}
      canTransferOwnership={permissions.canTransferOwnership}
      canRemoveMembers={Boolean(permissions.canRemoveMembers)}
      actorMembershipId={resolved.context.membershipId}
      actorUserId={resolved.context.userId}
    />
  );
}
