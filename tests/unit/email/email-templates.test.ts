import { describe, expect, it } from "vitest";

import { accountVerificationEmail, emailChangeVerificationEmail } from "@/features/auth/contracts";

describe("email templates", () => {
  it("renders an account verification link and escapes user-controlled values", () => {
    const html = accountVerificationEmail({
      name: "<Alex>",
      url: "https://example.com/verify?token=a&next=/dashboard",
    });

    expect(html).toContain("Verify your account");
    expect(html).toContain("Hello &lt;Alex&gt;");
    expect(html).toContain("token=a&amp;next=/dashboard");
    expect(html).not.toContain("Hello <Alex>");
  });

  it("explains that an email change is applied only after verification", () => {
    const html = emailChangeVerificationEmail({
      name: "Alex",
      url: "https://example.com/verify-email",
    });

    expect(html).toContain("Confirm your new email");
    expect(html).toContain("to apply it to your account");
    expect(html).toContain('href="https://example.com/verify-email"');
  });
});
