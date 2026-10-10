import Link from "next/link";
import { useTranslations } from "next-intl";

import type { OrganizationContext } from "../contracts";

interface Props {
  target: Pick<OrganizationContext, "organizationId" | "organizationSlug" | "organizationName">;
  active?: Pick<OrganizationContext, "organizationId" | "organizationSlug" | "organizationName">;
}

export function OrganizationContextChoice({ target, active }: Props) {
  const t = useTranslations("organizations.contextChoice");

  return (
    <section
      aria-labelledby="organization-context-title"
      className="mx-auto max-w-xl space-y-4 rounded-lg border p-6"
    >
      <h1 id="organization-context-title" className="text-xl font-semibold">
        {active ? t("changed") : t("select")}
      </h1>
      <p>
        {active ? t("active", { name: active.organizationName }) : t("none")}{" "}
        {t("instruction", { name: target.organizationName })}
      </p>
      {active ? (
        <Link
          className="border-input rounded-lg border px-3 py-1.5 text-sm"
          href={`/org/${active.organizationSlug}`}
        >
          {t("goToActive", { name: active.organizationName })}
        </Link>
      ) : null}
    </section>
  );
}
