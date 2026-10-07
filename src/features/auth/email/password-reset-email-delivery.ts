import "server-only";

import { eq } from "drizzle-orm";

import { env } from "@/config/env";
import { db } from "@/db/drizzle";
import { user as userTable } from "@/db/schema";
import { getLocaleFromCookieHeader, resolveLocale } from "@/i18n/config";
import { sendEmail } from "@/services/email/send-email";
import { invitationEmail } from "./invitation-email";
import { passwordResetEmail } from "./password-reset-email";

export async function sendLocalizedPasswordResetEmail(
  user: { id: string; name: string; email: string },
  url: string,
  request?: Request
) {
  const [persistedUser] = await db
    .select({ locale: userTable.locale, invitedAt: userTable.invitedAt })
    .from(userTable)
    .where(eq(userTable.id, user.id))
    .limit(1);

  const locale = resolveLocale({
    userLocale: persistedUser?.locale,
    cookieLocale: getLocaleFromCookieHeader(request?.headers.get("cookie")),
    acceptLanguage: request?.headers.get("accept-language"),
    defaultLocale: env.APP_DEFAULT_LOCALE,
  });
  const email = persistedUser?.invitedAt
    ? invitationEmail({ name: user.name, url, locale })
    : passwordResetEmail({ name: user.name, url, locale });

  await sendEmail({ to: user.email, subject: email.subject, html: email.html });
}
