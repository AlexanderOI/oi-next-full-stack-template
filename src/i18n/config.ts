import { z } from "zod";

export const locales = ["en", "es"] as const;
export const localeSchema = z.enum(locales);
export type Locale = z.infer<typeof localeSchema>;

export const fallbackLocale: Locale = "en";
export const localeCookieName = "APP_LOCALE";

export function isLocale(value: unknown): value is Locale {
  return localeSchema.safeParse(value).success;
}

export function getLocaleCookieOptions(isProduction: boolean) {
  return {
    path: "/",
    sameSite: "lax" as const,
    secure: isProduction,
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
  };
}

export function matchAcceptLanguage(value: string | null | undefined): Locale | null {
  if (!value) return null;

  const candidates = value
    .split(",")
    .map((entry, index) => {
      const [tag, ...parameters] = entry.trim().split(";");
      const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith("q="));
      const quality = qualityParameter ? Number(qualityParameter.trim().slice(2)) : 1;
      return { tag: tag?.toLowerCase(), quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter(({ tag, quality }) => Boolean(tag) && quality > 0)
    .sort((left, right) => right.quality - left.quality || left.index - right.index);

  for (const { tag } of candidates) {
    if (!tag || tag === "*") continue;
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }

  return null;
}

export function getLocaleFromCookieHeader(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const entry = value
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === localeCookieName);
  if (!entry?.[1]) return null;

  try {
    const cookieLocale = decodeURIComponent(entry[1]);
    return isLocale(cookieLocale) ? cookieLocale : null;
  } catch {
    return null;
  }
}

export function resolveLocale({
  userLocale,
  cookieLocale,
  acceptLanguage,
  defaultLocale,
}: {
  userLocale?: unknown;
  cookieLocale?: unknown;
  acceptLanguage?: string | null;
  defaultLocale?: unknown;
}): Locale {
  if (isLocale(userLocale)) return userLocale;
  if (isLocale(cookieLocale)) return cookieLocale;
  return (
    matchAcceptLanguage(acceptLanguage) ??
    (isLocale(defaultLocale) ? defaultLocale : fallbackLocale)
  );
}
