import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getCurrentSession } from "@/features/auth/server";
import * as organizationClient from "@/features/organizations/client";
import * as organizationServer from "@/features/organizations/server";

interface Props {
  params: Promise<{ organizationSlug: string }>;
}

export default async function OrganizationPage({ params }: Props) {
  const [{ organizationSlug }, current] = await Promise.all([params, getCurrentSession()]);
  const session = current
    ? {
        user: { id: current.user.id },
        session: {
          id: current.session.id,
          activeOrganizationId: current.session.activeOrganizationId ?? null,
        },
      }
    : null;
  const resolved = await organizationServer.resolveOrganizationContext(organizationSlug, session);
  if (!resolved.ok) notFound();
  const getInvitationPermissions = Object.prototype.hasOwnProperty.call(
    organizationServer,
    "getOrganizationInvitationPermissions"
  )
    ? organizationServer.getOrganizationInvitationPermissions
    : undefined;
  const [memberPermissions, invitationPermissions, canDeleteOrganization, t] = await Promise.all([
    organizationServer.getOrganizationMemberPermissions(
      resolved.context.userId,
      resolved.context.organizationId
    ),
    getInvitationPermissions
      ? getInvitationPermissions(resolved.context.userId, resolved.context.organizationId)
      : Promise.resolve({ canRead: false }),
    organizationServer.getOrganizationDeletionAvailability(
      resolved.context.userId,
      resolved.context.organizationId
    ),
    getTranslations("organizations.members"),
  ]);

  return (
    <section aria-labelledby="organization-title" className="space-y-2">
      <h2 id="organization-title" className="text-lg font-medium">
        {t("workspace")}
      </h2>
      {memberPermissions.canRead && (
        <Link href={`/org/${resolved.context.organizationSlug}/members`}>{t("manageMembers")}</Link>
      )}
      {invitationPermissions.canRead && (
        <Link href={`/org/${resolved.context.organizationSlug}/invitations`}>
          {t("manageInvitations")}
        </Link>
      )}
      {canDeleteOrganization && (
        <organizationClient.OrganizationDeletionPanel
          organizationSlug={resolved.context.organizationSlug}
          canDelete={canDeleteOrganization}
        />
      )}
    </section>
  );
}
