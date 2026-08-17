import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Permission, PERMISSIONS } from "@/features/authorization/client";
import { getTranslations } from "next-intl/server";

export default async function AdminPage() {
  const t = await getTranslations("authorization.admin");
  const roles = await getTranslations("authorization.roles");
  const users = await getTranslations("authorization.users");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Permission permissions={PERMISSIONS.ROLES_READ}>
          <Link href="/admin/roles">
            <Card className="hover:bg-muted/40 h-full transition-colors">
              <CardHeader>
                <CardTitle>{roles("title")}</CardTitle>
              </CardHeader>
              <CardContent>{t("rolesDescription")}</CardContent>
            </Card>
          </Link>
        </Permission>
        <Permission permissions={PERMISSIONS.USERS_READ}>
          <Link href="/admin/users">
            <Card className="hover:bg-muted/40 h-full transition-colors">
              <CardHeader>
                <CardTitle>{users("title")}</CardTitle>
              </CardHeader>
              <CardContent>{t("usersDescription")}</CardContent>
            </Card>
          </Link>
        </Permission>
      </div>
    </div>
  );
}
