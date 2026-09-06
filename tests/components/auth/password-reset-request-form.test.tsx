import { renderInEnglish as render, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requestPasswordReset: vi.fn() }));

vi.mock("@/features/auth/lib/auth-client", () => ({
  authClient: { requestPasswordReset: mocks.requestPasswordReset },
}));

import { PasswordResetRequestForm } from "@/features/auth/client";

describe("PasswordResetRequestForm", () => {
  beforeEach(() => {
    mocks.requestPasswordReset.mockReset();
  });

  it.each(["Email was sent", "User was not found"])(
    "shows the same neutral result regardless of the provider response",
    async (providerMessage) => {
      const user = userEvent.setup();
      mocks.requestPasswordReset.mockResolvedValue({
        data: { status: true, message: providerMessage },
        error: null,
      });
      render(<PasswordResetRequestForm />);

      await user.type(screen.getByRole("textbox", { name: "Email" }), "person@example.com");
      await user.click(screen.getByRole("button", { name: "Send reset link" }));

      expect(await screen.findByRole("status")).toHaveTextContent(
        "If an account exists for that email address, a password reset link has been sent."
      );
      expect(screen.queryByText(providerMessage)).not.toBeInTheDocument();
      expect(mocks.requestPasswordReset).toHaveBeenCalledWith({
        email: "person@example.com",
        redirectTo: "/auth/reset-password",
      });
    }
  );

  it("validates email before requesting a reset", async () => {
    const user = userEvent.setup();
    render(<PasswordResetRequestForm />);

    await user.type(screen.getByRole("textbox", { name: "Email" }), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText("Invalid email address")).toBeInTheDocument();
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
  });

  it("shows a retryable service error without claiming the account is missing", async () => {
    const user = userEvent.setup();
    mocks.requestPasswordReset.mockResolvedValue({ data: null, error: { message: "Unavailable" } });
    render(<PasswordResetRequestForm />);

    await user.type(screen.getByRole("textbox", { name: "Email" }), "person@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We could not request a reset link right now. Please try again."
    );
    expect(screen.getByRole("button", { name: "Send reset link" })).toBeEnabled();
    await waitFor(() => expect(mocks.requestPasswordReset).toHaveBeenCalledOnce());
  });
});
