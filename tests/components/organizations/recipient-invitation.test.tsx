import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  accept: vi.fn(),
  reject: vi.fn(),
  refresh: vi.fn(),
  locale: "en",
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    const prefix = mocks.locale === "es" ? "es:" : "";
    return values ? `${prefix}${key}:${Object.values(values).join(",")}` : `${prefix}${key}`;
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/components/ui/button", () => ({
  Button: (props: React.ComponentProps<"button">) => <button {...props} />,
}));

import { RecipientInvitation } from "@/features/organizations/components/recipient-invitation";
import type { RecipientInvitationView } from "@/features/organizations/contracts";

const invitation: Extract<RecipientInvitationView, { state: "invitation" }> = {
  state: "invitation",
  email: "recipient@example.com",
  status: "pending",
  expiresAt: "2031-01-01T00:00:00.000Z",
  organizationId: "org-target",
  organizationName: "Target Org",
  organizationSlug: "target",
  roleName: "Analyst",
  canAccept: true,
  canReject: true,
  showSwitch: false,
  activeOrganizationName: null,
};

function renderRecipient(view: Extract<RecipientInvitationView, { state: "invitation" }>) {
  const { organizationId, ...clientView } = view;
  void organizationId;
  return render(
    <RecipientInvitation
      view={clientView}
      acceptAction={() => mocks.accept()}
      rejectAction={() => mocks.reject()}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.locale = "en";
  mocks.accept.mockResolvedValue({
    success: true,
    data: { changed: true, invitationId: "secret-capability" },
  });
  mocks.reject.mockResolvedValue({
    success: true,
    data: { changed: true, invitationId: "secret-capability" },
  });
});

describe("recipient invitation UI", () => {
  it("shows generic anonymous instructions and auth links without the invitation capability", () => {
    const { container } = render(<RecipientInvitation view={{ state: "sign-in-required" }} />);
    expect(screen.getByText("anonymousInstructions")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "signIn" })).toHaveAttribute("href", "/auth/sign-in");
    expect(screen.getByRole("link", { name: "signUp" })).toHaveAttribute("href", "/auth/sign-up");
    expect(container.textContent).not.toContain("secret-capability");
    expect(screen.getByText("reopenOriginalLink")).toBeInTheDocument();
  });

  it("renders a generic no-detail state for mismatched recipients", () => {
    render(<RecipientInvitation view={{ state: "unavailable" }} />);
    expect(screen.getByText("unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Target Org")).not.toBeInTheDocument();
    expect(screen.queryByText("Analyst")).not.toBeInTheDocument();
  });

  it("allows a matching unverified recipient to reject without exposing invitation details", async () => {
    render(
      <RecipientInvitation
        view={{ state: "verify-email", canReject: true }}
        rejectAction={() => mocks.reject()}
      />
    );
    expect(screen.getByText("verifyEmailInstructions")).toBeInTheDocument();
    expect(screen.queryByText("Target Org")).not.toBeInTheDocument();
    expect(screen.queryByText("Analyst")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "reject" }));
    await waitFor(() => expect(mocks.reject).toHaveBeenCalledOnce());
    expect(await screen.findByText("rejectedFeedback")).toBeInTheDocument();
  });

  it("shows matched pending metadata and accept/reject actions with result feedback", async () => {
    renderRecipient(invitation);
    expect(screen.getByText("organization:Target Org")).toBeInTheDocument();
    expect(screen.getByText("role:Analyst")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "accept" }));
    await waitFor(() => expect(mocks.accept).toHaveBeenCalledOnce());
    expect(await screen.findByText("acceptedFeedback")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "reject" }));
    await waitFor(() => expect(mocks.reject).toHaveBeenCalledOnce());
    expect(await screen.findByText("rejectedFeedback")).toBeInTheDocument();
  });

  it.each(["en", "es"])("links to the header selector without switching in %s", (locale) => {
    mocks.locale = locale;
    renderRecipient({
      ...invitation,
      status: "accepted",
      canAccept: false,
      canReject: false,
      showSwitch: true,
      activeOrganizationName: "Other Org",
    });
    const prefix = locale === "es" ? "es:" : "";
    expect(screen.getByText(`${prefix}switchPrompt:Other Org`)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: `${prefix}goToOrganizationSelector` });
    expect(link).toHaveAttribute("href", "/org");
    expect(link.getAttribute("href")).not.toContain("secret-capability");
    expect(link.getAttribute("href")).not.toContain("target");
    expect(screen.queryByRole("button", { name: /switchOrganization/ })).not.toBeInTheDocument();
  });

  it("omits the selector link when switching is not offered", () => {
    renderRecipient(invitation);
    expect(
      screen.queryByRole("link", { name: "goToOrganizationSelector" })
    ).not.toBeInTheDocument();
  });

  it.each(["expired", "rejected", "canceled"] as const)(
    "shows %s terminal state without response actions",
    (status) => {
      renderRecipient({ ...invitation, status, canAccept: false, canReject: false });
      expect(document.body.textContent).toContain(`${status}:`);
      expect(screen.queryByRole("button", { name: "accept" })).not.toBeInTheDocument();
    }
  );

  it("renders Spanish localized copy", () => {
    mocks.locale = "es";
    render(<RecipientInvitation view={{ state: "sign-in-required" }} />);
    expect(screen.getByText("es:anonymousInstructions")).toBeInTheDocument();
  });
});
