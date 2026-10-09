import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  accept: vi.fn(),
  reject: vi.fn(),
  switchOrg: vi.fn(),
  push: vi.fn(),
  locale: "en",
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    const prefix = mocks.locale === "es" ? "es:" : "";
    return values ? `${prefix}${key}:${Object.values(values).join(",")}` : `${prefix}${key}`;
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: vi.fn() }),
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
      switchAction={() => mocks.switchOrg()}
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
  mocks.switchOrg.mockResolvedValue({ success: true, href: "/org/target" });
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

  it("shows accepted switch CTA but does not switch until explicitly clicked", async () => {
    renderRecipient({
      ...invitation,
      status: "accepted",
      canAccept: false,
      canReject: false,
      showSwitch: true,
      activeOrganizationName: "Other Org",
    });
    expect(mocks.switchOrg).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "switchOrganization" }));
    await waitFor(() => expect(mocks.switchOrg).toHaveBeenCalledOnce());
    expect(mocks.push).toHaveBeenCalledWith("/org/target");
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
