import { useTranslations } from "next-intl";

import type { ActiveOrganizationOption } from "../contracts";

interface Props {
  organizations: ActiveOrganizationOption[];
}

export function OrganizationChooser({ organizations }: Props) {
  const t = useTranslations("organizations.chooser");

  if (organizations.length === 0) {
    return (
      <section className="mx-auto max-w-xl space-y-2 rounded-lg border p-6">
        <h1 className="text-xl font-semibold">{t("noAccess")}</h1>
        <p>{t("noMembership")}</p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="organization-chooser-title"
      className="mx-auto max-w-xl space-y-4 rounded-lg border p-6"
    >
      <h1 id="organization-chooser-title" className="text-xl font-semibold">
        {t("title")}
      </h1>
      <p className="text-muted-foreground text-sm">{t("instruction")}</p>
      <ul className="space-y-2">
        {organizations.map((organization) => (
          <li key={organization.id}>{organization.name}</li>
        ))}
      </ul>
    </section>
  );
}
