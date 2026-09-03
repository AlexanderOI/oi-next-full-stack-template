import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eq: vi.fn(),
  from: vi.fn(),
  limit: vi.fn(),
  select: vi.fn(),
  sendEmail: vi.fn(),
  where: vi.fn(),
}));

vi.mock("@/config/env", () => ({ env: { APP_DEFAULT_LOCALE: "en" } }));
vi.mock("@/db/schema", () => ({ user: { id: "user.id", locale: "user.locale" } }));
vi.mock("drizzle-orm", () => ({ eq: mocks.eq }));
vi.mock("@/db/drizzle", () => ({ db: { select: mocks.select } }));
vi.mock("@/services/email/send-email", () => ({ sendEmail: mocks.sendEmail }));

import { sendLocalizedVerificationEmail } from "@/features/auth/email/verification-email-delivery";

describe("sendLocalizedVerificationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.select.mockReturnValue({ from: mocks.from });
    mocks.from.mockReturnValue({ where: mocks.where });
    mocks.where.mockReturnValue({ limit: mocks.limit });
    mocks.eq.mockImplementation((column, value) => ({ column, value }));
  });

  it("uses persisted user locale without a locale cookie", async () => {
    mocks.limit.mockResolvedValue([{ locale: "es" }]);

    await sendLocalizedVerificationEmail(
      { id: "user-7", name: "Alex", email: "alex@example.com" },
      "https://example.com/verify",
      new Request("https://example.com/api/auth/send-verification", {
        headers: { "accept-language": "en" },
      })
    );

    expect(mocks.eq).toHaveBeenCalledWith("user.id", "user-7");
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Verifica tu cuenta",
        html: expect.stringContaining('<html lang="es">'),
      })
    );
  });

  it("ignores a malformed cookie and falls through to Accept-Language", async () => {
    mocks.limit.mockResolvedValue([{ locale: null }]);

    await expect(
      sendLocalizedVerificationEmail(
        { id: "user-8", name: "Alex", email: "alex@example.com" },
        "https://example.com/verify",
        new Request("https://example.com/api/auth/send-verification", {
          headers: { cookie: "APP_LOCALE=%", "accept-language": "es" },
        })
      )
    ).resolves.toBeUndefined();
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Verifica tu cuenta" })
    );
  });
});
