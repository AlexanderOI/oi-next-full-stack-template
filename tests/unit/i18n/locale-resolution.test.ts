import { describe, expect, it } from "vitest";

import {
  fallbackLocale,
  getLocaleFromCookieHeader,
  matchAcceptLanguage,
  resolveLocale,
} from "@/i18n/config";

describe("locale resolution", () => {
  it("matches supported base languages by quality", () => {
    expect(matchAcceptLanguage("fr-CA, es-MX;q=0.9, en;q=0.8")).toBe("es");
    expect(matchAcceptLanguage("fr, de;q=0.8")).toBeNull();
    expect(matchAcceptLanguage("es;q=0, en;q=0.5")).toBe("en");
  });

  it("reads only a valid locale cookie", () => {
    expect(getLocaleFromCookieHeader("theme=dark; APP_LOCALE=es; session=abc")).toBe("es");
    expect(getLocaleFromCookieHeader("APP_LOCALE=fr")).toBeNull();
  });

  it("ignores malformed percent-encoding and continues locale fallback", () => {
    const cookieLocale = getLocaleFromCookieHeader("APP_LOCALE=%");

    expect(cookieLocale).toBeNull();
    expect(
      resolveLocale({
        cookieLocale,
        acceptLanguage: "es-MX, en;q=0.8",
        defaultLocale: "en",
      })
    ).toBe("es");
  });

  it("applies user, cookie, browser, environment, and hard fallback precedence", () => {
    const base = {
      userLocale: "es",
      cookieLocale: "en",
      acceptLanguage: "es",
      defaultLocale: "en",
    };
    expect(resolveLocale(base)).toBe("es");
    expect(resolveLocale({ ...base, userLocale: null })).toBe("en");
    expect(resolveLocale({ ...base, userLocale: null, cookieLocale: null })).toBe("es");
    expect(
      resolveLocale({ ...base, userLocale: null, cookieLocale: null, acceptLanguage: "fr" })
    ).toBe("en");
    expect(
      resolveLocale({
        userLocale: null,
        cookieLocale: "invalid",
        acceptLanguage: "fr",
        defaultLocale: "invalid",
      })
    ).toBe(fallbackLocale);
  });
});
