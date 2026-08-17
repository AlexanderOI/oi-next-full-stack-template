import { Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getTranslations } from "next-intl/server";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  return (
    <div className="space-y-8">
      <PageHeader title={t("title")} description={t("description")} />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-600/15">
              <Clock className="size-4.5 text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-base">{t("empty")}</CardTitle>
              <CardDescription>{t("empty")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">{t("empty")}</CardContent>
      </Card>
    </div>
  );
}
