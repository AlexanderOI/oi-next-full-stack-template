import { redirect } from "next/navigation";
import { requireSession } from "@/features/auth/server";
import { assertPermission, PERMISSIONS } from "@/features/authorization/server";
import {
  AvatarUploader,
  LanguageSelector,
  PasswordChangeForm,
  ProfileDetailsForm,
} from "@/features/profile/client";
import type { ProfileUser } from "@/features/profile/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLocale, getTranslations } from "next-intl/server";
import { isLocale } from "@/i18n/config";

export default async function ProfilePage() {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("profile")]);
  let session;
  try {
    session = await requireSession();
    await assertPermission(PERMISSIONS.PROFILE_READ_OWN);
  } catch {
    if (!session) redirect("/auth/sign-in");
    redirect("/forbidden");
  }

  if (!session) {
    redirect("/auth/sign-in");
  }

  const user: ProfileUser = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    username: session.user.username ?? null,
    image: session.user.image ?? null,
    locale: isLocale(session.user.locale) ? session.user.locale : null,
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("manageAccount")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="w-3/4">
              <ProfileDetailsForm user={user} />
            </div>
            <div className="w-1/4">
              <AvatarUploader user={user} />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("language.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <LanguageSelector locale={locale} />
        </CardContent>
      </Card>
      <PasswordChangeForm />
    </div>
  );
}
