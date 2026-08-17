import "server-only";

import { cookies, headers } from "next/headers";

import { env } from "@/config/env";
import { auth } from "@/features/auth/server";
import { localeCookieName, resolveLocale } from "./config";

export async function getRequestLocale() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  const cookieStore = await cookies();

  return resolveLocale({
    userLocale: session?.user.locale,
    cookieLocale: cookieStore.get(localeCookieName)?.value,
    acceptLanguage: requestHeaders.get("accept-language"),
    defaultLocale: env.APP_DEFAULT_LOCALE,
  });
}
