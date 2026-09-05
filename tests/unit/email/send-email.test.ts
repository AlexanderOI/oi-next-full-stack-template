import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createTransport: vi.fn(), sendMail: vi.fn() }));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail }),
  },
}));
vi.mock("@/config/env", () => ({
  env: {
    SMTP_HOST: "smtp.example.com",
    SMTP_PORT: 465,
    SMTP_USER: "smtp-user",
    SMTP_PASS: "smtp-password",
    EMAIL_FROM: "accounts@example.com",
  },
}));

import { sendEmail } from "@/services/email/send-email";

describe("sendEmail", () => {
  beforeEach(() => {
    mocks.sendMail.mockReset();
    mocks.sendMail.mockResolvedValue({ messageId: "message-1" });
  });

  it("configures secure SMTP and sends the complete application message", async () => {
    expect(mocks.createTransport).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 465,
      secure: true,
      auth: { user: "smtp-user", pass: "smtp-password" },
    });

    await expect(
      sendEmail({
        to: "alex@example.com",
        subject: "Verify your account",
        html: "<p>Verify</p>",
      })
    ).resolves.toBeUndefined();
    expect(mocks.sendMail).toHaveBeenCalledWith({
      from: "accounts@example.com",
      to: "alex@example.com",
      subject: "Verify your account",
      html: "<p>Verify</p>",
    });
  });

  it("propagates transport rejection to the calling business flow", async () => {
    mocks.sendMail.mockRejectedValue(new Error("SMTP rejected recipient"));

    await expect(
      sendEmail({ to: "invalid@example.com", subject: "Verify", html: "<p>Verify</p>" })
    ).rejects.toThrow("SMTP rejected recipient");
  });
});
