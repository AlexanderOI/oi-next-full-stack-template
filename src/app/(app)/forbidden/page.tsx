import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getTranslations } from "next-intl/server";

export default async function ForbiddenPage() {
  const t = await getTranslations("errors");
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-20 text-center">
      <p className="text-muted-foreground text-sm font-medium">403</p>
      <h1 className="text-3xl font-semibold">{t("forbiddenTitle")}</h1>
      <p className="text-muted-foreground">{t("forbiddenDescription")}</p>
      <Button render={<Link href="/dashboard" />}>{t("returnDashboard")}</Button>
    </div>
  );
}
