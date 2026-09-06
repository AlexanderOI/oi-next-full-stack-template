import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/client", () => ({
  PasswordResetForm: ({ token }: { token: string | null }) => <div data-token={token ?? "none"} />,
}));

import ResetPasswordPage from "@/app/(auth)/auth/reset-password/page";

describe("public password-reset pages", () => {
  it("passes only an unambiguous valid token to the reset form", async () => {
    const valid = await ResetPasswordPage({ searchParams: Promise.resolve({ token: "valid" }) });
    const invalid = await ResetPasswordPage({
      searchParams: Promise.resolve({ token: "valid", error: "INVALID_TOKEN" }),
    });
    const ambiguous = await ResetPasswordPage({
      searchParams: Promise.resolve({ token: ["one", "two"] }),
    });
    const unexpectedError = await ResetPasswordPage({
      searchParams: Promise.resolve({ token: "valid", error: ["unexpected"] }),
    });

    expect(valid.props.token).toBe("valid");
    expect(invalid.props.token).toBeNull();
    expect(ambiguous.props.token).toBeNull();
    expect(unexpectedError.props.token).toBeNull();
  });
});
