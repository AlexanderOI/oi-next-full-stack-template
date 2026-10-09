"use client";

import { useTranslations } from "next-intl";

import { DeleteOrganizationDialog } from "./delete-organization-dialog";

interface Props {
  organizationSlug: string;
  canDelete: boolean;
}

export function OrganizationDeletionPanel({ organizationSlug, canDelete }: Props) {
  const t = useTranslations("organizations.deletion");
  if (!canDelete) return null;
  return (
    <section aria-labelledby="organization-deletion-title" className="border-t pt-4">
      <h3 id="organization-deletion-title" className="mb-2 font-medium">
        {t("sectionTitle")}
      </h3>
      <DeleteOrganizationDialog organizationSlug={organizationSlug} />
    </section>
  );
}
