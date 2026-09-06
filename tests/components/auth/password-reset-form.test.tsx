import { renderInEnglish as render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resetPassword: vi.fn() }));

vi.mock("@/features/auth/lib/auth-client", () => ({
  authClient: { resetPassword: mocks.resetPassword },
}));

import { PasswordResetForm } from "@/features/auth/client";

describe("PasswordResetForm", () => {
  beforeEach(() => {
    mocks.resetPassword.mockReset();
  });

  it("rejects a missing or invalid token without rendering a password form", () => {
    render(<PasswordResetForm token={null} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "This password reset link is missing, invalid, or expired."
    );
    expect(screen.getByRole("link", { name: "Request a new reset link" })).toHaveAttribute(
      "href",
      "/auth/forgot-password"
    );
    expect(screen.queryByRole("button", { name: "Reset password" })).not.toBeInTheDocument();
  });

  it("validates password length and confirmation before calling Better Auth", async () => {
    const user = userEvent.setup();
    render(<PasswordResetForm token="valid-token" />);

    await user.type(screen.getByLabelText("New password"), "short");
    await user.type(screen.getByLabelText("Confirm password"), "different");
    await user.click(screen.getByRole("button", { name: "Reset password" }));

    expect(await screen.findByText("Password must be at least 8 characters")).toBeInTheDocument();
    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });

  it("submits the token and provides a clear path to sign in after success", async () => {
    const user = userEvent.setup();
    mocks.resetPassword.mockResolvedValue({ data: { status: true }, error: null });
    render(<PasswordResetForm token="valid-token" />);

    await user.type(screen.getByLabelText("New password"), "new-password");
    await user.type(screen.getByLabelText("Confirm password"), "new-password");
    await user.click(screen.getByRole("button", { name: "Reset password" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your password has been reset successfully. You can now sign in."
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/auth/sign-in");
    expect(mocks.resetPassword).toHaveBeenCalledWith({
      newPassword: "new-password",
      token: "valid-token",
    });
  });

  it("keeps the form retryable when Better Auth rejects the reset", async () => {
    const user = userEvent.setup();
    mocks.resetPassword.mockResolvedValue({ data: null, error: { message: "Invalid token" } });
    render(<PasswordResetForm token="expired-token" />);

    await user.type(screen.getByLabelText("New password"), "new-password");
    await user.type(screen.getByLabelText("Confirm password"), "new-password");
    await user.click(screen.getByRole("button", { name: "Reset password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This reset link could not be used. Request a new link and try again."
    );
    expect(screen.getByRole("link", { name: "Request a new reset link" })).toHaveAttribute(
      "href",
      "/auth/forgot-password"
    );
    expect(screen.getByRole("button", { name: "Reset password" })).toBeEnabled();
  });
});
