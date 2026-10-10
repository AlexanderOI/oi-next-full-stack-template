import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  view: vi.fn(),
  accept: vi.fn(),
  reject: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
vi.mock("@/features/auth/server", () => ({ getCurrentSession: mocks.session }));
vi.mock("@/features/organizations/server", () => ({
  getRecipientInvitation: mocks.view,
  acceptOrganizationInvitationAction: mocks.accept,
  rejectOrganizationInvitationAction: mocks.reject,
}));
vi.mock("@/features/organizations/client", () => ({
  RecipientInvitation: (props: { view: unknown; acceptAction?: unknown }) => (
    <pre>{JSON.stringify({ view: props.view, hasAcceptAction: Boolean(props.acceptAction) })}</pre>
  ),
}));

import RecipientInvitationPage from "@/app/(auth)/invitations/[invitationId]/page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(null);
  mocks.view.mockResolvedValue({ state: "sign-in-required" });
});

describe("public recipient invitation route", () => {
  it("renders outside the active-organization shell and reads only a signed-in recipient view", async () => {
    const page = await RecipientInvitationPage({
      params: Promise.resolve({ invitationId: "secret-capability" }),
    });
    expect(JSON.stringify(page)).toContain("sign-in-required");
    expect(mocks.view).toHaveBeenCalledWith("secret-capability", null);
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("passes an authenticated recipient session without requiring target membership", async () => {
    const session = {
      user: { id: "user-1", email: "recipient@example.com", emailVerified: true },
      session: { activeOrganizationId: "personal-org" },
    };
    mocks.session.mockResolvedValue(session);
    mocks.view.mockResolvedValue({
      state: "invitation",
      organizationId: "target-org",
      status: "pending",
      canAccept: true,
      canReject: true,
      showSwitch: false,
    });
    const page = await RecipientInvitationPage({
      params: Promise.resolve({ invitationId: "secret-capability" }),
    });
    expect(mocks.view).toHaveBeenCalledWith("secret-capability", session);
    expect(mocks.notFound).not.toHaveBeenCalled();
    const pageProps = (page as { props: Record<string, unknown> }).props;
    expect(JSON.stringify(pageProps.view)).not.toContain("secret-capability");
    expect(pageProps.acceptAction).toEqual(expect.any(Function));
    expect(pageProps).not.toHaveProperty("switchAction");
    expect(pageProps.view).not.toHaveProperty("organizationId");
  });

  it("does not bind a switch mutation for an accepted invitation with a switch prompt", async () => {
    mocks.view.mockResolvedValue({
      state: "invitation",
      organizationId: "target-org",
      status: "accepted",
      canAccept: false,
      canReject: false,
      showSwitch: true,
    });
    const page = await RecipientInvitationPage({
      params: Promise.resolve({ invitationId: "secret-capability" }),
    });
    const pageProps = (page as { props: Record<string, unknown> }).props;
    expect(pageProps).not.toHaveProperty("switchAction");
    expect(pageProps.view).not.toHaveProperty("organizationId");
  });
});
