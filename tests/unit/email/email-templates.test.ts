import { describe, expect, it } from "vitest";

import {
  accountVerificationEmail,
  emailChangeVerificationEmail,
  passwordResetEmail,
} from "@/features/auth/contracts";

describe("email templates", () => {
  it.each([
    ["en" as const, "Verify your account", "Hello &lt;Alex&gt;"],
    ["es" as const, "Verifica tu cuenta", "Hola, &lt;Alex&gt;:"],
  ])("renders account verification in %s with escaped values", (locale, subject, greeting) => {
    const email = accountVerificationEmail({
      name: "<Alex>",
      url: "https://example.com/verify?token=a&next=/dashboard",
      locale,
    });

    expect(email.subject).toBe(subject);
    expect(email.html).toContain(`<html lang="${locale}">`);
    expect(email.html).toContain(greeting);
    expect(email.html).toContain("token=a&amp;next=/dashboard");
    expect(email.html).not.toContain("Hello <Alex>");
  });

  it.each([
    [
      "en" as const,
      "Reset your password",
      "If you did not request a password reset",
      "Hello &lt;Alex&gt;",
    ],
    [
      "es" as const,
      "Restablece tu contraseña",
      "Si no solicitaste restablecer",
      "Hola, &lt;Alex&gt;:",
    ],
  ])("renders a secure password-reset message in %s", (locale, subject, body, greeting) => {
    const email = passwordResetEmail({
      name: "<Alex>",
      url: 'https://example.com/reset?token=a&next="><script>alert(1)</script>',
      locale,
    });

    expect(email.subject).toBe(subject);
    expect(email.html).toContain(`<html lang="${locale}">`);
    expect(email.html).toContain(body);
    expect(email.html).toContain(greeting);
    expect(email.html).toContain(
      "token=a&amp;next=&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"
    );
    expect(email.html).not.toContain("<script>");
  });

  it.each([
    ["en" as const, "Confirm your new email", "to apply it to your account"],
    ["es" as const, "Confirma tu nuevo correo electrónico", "aplicarla a tu cuenta"],
  ])("renders email-change verification in %s", (locale, subject, body) => {
    const email = emailChangeVerificationEmail({
      name: "Alex",
      url: "https://example.com/verify-email",
      locale,
    });

    expect(email.subject).toBe(subject);
    expect(email.html).toContain(body);
    expect(email.html).toContain(`<html lang="${locale}">`);
    expect(email.html).toContain('href="https://example.com/verify-email"');
  });
});
