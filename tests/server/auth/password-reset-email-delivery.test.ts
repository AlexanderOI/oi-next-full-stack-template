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
vi.mock("@/db/schema", () => ({
  user: { id: "user.id", locale: "user.locale", invitedAt: "user.invitedAt" },
}));
vi.mock("drizzle-orm", () => ({ eq: mocks.eq }));
vi.mock("@/db/drizzle", () => ({ db: { select: mocks.select } }));
vi.mock("@/services/email/send-email", () => ({ sendEmail: mocks.sendEmail }));

import { sendLocalizedPasswordResetEmail } from "@/features/auth/email/password-reset-email-delivery";

describe("sendLocalizedPasswordResetEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.select.mockReturnValue({ from: mocks.from });
    mocks.from.mockReturnValue({ where: mocks.where });
    mocks.where.mockReturnValue({ limit: mocks.limit });
    mocks.eq.mockImplementation((column, value) => ({ column, value }));
  });

  it("uses the persisted locale and sends the Better Auth generated URL", async () => {
    mocks.limit.mockResolvedValue([{ locale: "es", invitedAt: null }]);

    await sendLocalizedPasswordResetEmail(
      { id: "user-9", name: "Alex", email: "alex@example.com" },
      "https://example.com/api/auth/reset-password/token?callbackURL=%2Fauth%2Freset-password",
      new Request("https://example.com/api/auth/request-password-reset", {
        headers: { "accept-language": "en" },
      })
    );

    expect(mocks.eq).toHaveBeenCalledWith("user.id", "user-9");
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alex@example.com",
        subject: "Restablece tu contraseña",
        html: expect.stringContaining("token?callbackURL=%2Fauth%2Freset-password"),
      })
    );
  });

  it("falls back safely to request locale when no persisted locale exists", async () => {
    mocks.limit.mockResolvedValue([{ locale: null, invitedAt: null }]);

    await sendLocalizedPasswordResetEmail(
      { id: "user-10", name: "Alex", email: "alex@example.com" },
      "https://example.com/reset",
      new Request("https://example.com/api/auth/request-password-reset", {
        headers: { cookie: "APP_LOCALE=%", "accept-language": "es" },
      })
    );

    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Restablece tu contraseña" })
    );
  });

  it("sends localized invitation content when the persisted account is pending", async () => {
    mocks.limit.mockResolvedValue([{ locale: "es", invitedAt: new Date("2026-09-29") }]);

    await sendLocalizedPasswordResetEmail(
      { id: "user-11", name: "Alex", email: "alex@example.com" },
      "https://example.com/api/auth/reset-password/invitation-token?callbackURL=%2Fauth%2Freset-password"
    );

    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alex@example.com",
        subject: "Te han invitado a oi-nextjs",
        html: expect.stringContaining("Aceptar invitación"),
      })
    );
  });
});
