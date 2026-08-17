import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  getSession: vi.fn(),
  headers: new Headers({ "accept-language": "en" }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: mocks.cookieGet })),
  headers: vi.fn(async () => mocks.headers),
}));
vi.mock("@/config/env", () => ({ env: { APP_DEFAULT_LOCALE: "en" } }));
vi.mock("@/features/auth/server", () => ({ auth: { api: { getSession: mocks.getSession } } }));

import { getRequestLocale } from "@/i18n/request-locale";

describe("getRequestLocale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookieGet.mockReturnValue(undefined);
  });

  it("honors persisted session locale on a cookie-free new device", async () => {
    mocks.getSession.mockResolvedValue({ user: { locale: "es" } });

    await expect(getRequestLocale()).resolves.toBe("es");
    expect(mocks.getSession).toHaveBeenCalledWith({ headers: mocks.headers });
    expect(mocks.cookieGet).toHaveBeenCalledWith("APP_LOCALE");
  });
});
