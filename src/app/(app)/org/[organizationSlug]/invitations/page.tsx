import { notFound } from "next/navigation";

import { getCurrentSession } from "@/features/auth/server";
import { OrganizationInvitationAdministration } from "@/features/organizations/client";
import {
  getOrganizationInvitationPermissions,
  listOrganizationInvitations,
  resolveOrganizationContext,
} from "@/features/organizations/server";

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

function sorting(value: string | undefined) {
  if (value) {
    try {
      const decoded: unknown = JSON.parse(value);
      if (
        Array.isArray(decoded) &&
        decoded[0] &&
        typeof decoded[0].id === "string" &&
        typeof decoded[0].desc === "boolean"
      ) {
        return {
          sort: decoded[0].id,
          direction: decoded[0].desc ? ("desc" as const) : ("asc" as const),
        };
      }
    } catch {
      // Invalid URL sorting falls back to the stable default.
    }
  }
  return { sort: "createdAt", direction: "desc" as const };
}

export default async function OrganizationInvitationsPage({ params, searchParams }: Props) {
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

  const permissions = await getOrganizationInvitationPermissions(
    resolved.context.userId,
    resolved.context.organizationId
  );
  if (!permissions.canRead) notFound();

  const { sort, direction } = sorting(first(query.sort));
  const data = await listOrganizationInvitations({
    organizationId: resolved.context.organizationId,
    page: positiveInteger(first(query.page), 1),
    pageSize: positiveInteger(first(query.perPage), 20),
    search: first(query.search) ?? "",
    status: first(query.status) ?? "all",
    sort,
    direction,
  });

  return (
    <OrganizationInvitationAdministration
      data={data}
      canCreate={permissions.canCreate}
      canResend={permissions.canResend}
      canCancel={permissions.canCancel}
      canTransferOwnership={permissions.canTransferOwnership}
    />
  );
}
