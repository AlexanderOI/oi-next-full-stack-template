import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  snapshot: vi.fn(),
  organizations: vi.fn(),
  members: vi.fn(),
  invitations: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("@/features/app-shell/client", () => ({ AppHeader: () => null, AppSidebar: () => null }));
vi.mock("@/features/app-shell/server", () => ({
  getSidebarCollapsed: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/features/auth/server", () => ({ requireSession: mocks.session }));
vi.mock("@/features/authorization/client", () => ({
  AuthorizationProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock("@/features/authorization/server", () => ({ getAuthorizationSnapshot: mocks.snapshot }));
vi.mock("@/features/organizations/server", () => ({
  getActiveOrganizations: mocks.organizations,
  getOrganizationMemberPermissions: mocks.members,
  getOrganizationInvitationPermissions: mocks.invitations,
}));

import AppLayout from "@/app/(app)/layout";

async function sidebarProps() {
  const layout = await AppLayout({ children: null });
  const shell = layout.props.children;
  return shell.props.children[1].props.children[0].props;
}

describe("organization navigation layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue({
      user: { id: "user-1" },
      session: { activeOrganizationId: "org-1" },
    });
    mocks.snapshot.mockResolvedValue({ userId: "user-1", roles: [], permissions: [] });
    mocks.organizations.mockResolvedValue([{ id: "org-1", slug: "alpha", name: "Alpha" }]);
    mocks.members.mockResolvedValue({ canRead: true });
    mocks.invitations.mockResolvedValue({ canRead: true });
  });

  it("passes verified workspace and scoped owner read grants", async () => {
    expect((await sidebarProps()).organizationNavigation).toEqual({
      slug: "alpha",
      canReadMembers: true,
      canReadInvitations: true,
    });
    expect(mocks.organizations).toHaveBeenCalledWith("user-1");
    expect(mocks.members).toHaveBeenCalledWith("user-1", "org-1");
    expect(mocks.invitations).toHaveBeenCalledWith("user-1", "org-1");
  });

  it.each([null, "stale"])("does not expose a tenant for active ID %s", async (activeId) => {
    mocks.session.mockResolvedValue({
      user: { id: "user-1" },
      session: { activeOrganizationId: activeId },
    });
    expect((await sidebarProps()).organizationNavigation).toBeNull();
    expect(mocks.members).not.toHaveBeenCalled();
    expect(mocks.invitations).not.toHaveBeenCalled();
  });

  it("preserves independent partial scoped grants regardless of platform permissions", async () => {
    mocks.snapshot.mockResolvedValue({
      userId: "user-1",
      roles: ["admin"],
      permissions: ["roles:read"],
    });
    mocks.members.mockResolvedValue({ canRead: false });
    expect((await sidebarProps()).organizationNavigation).toEqual({
      slug: "alpha",
      canReadMembers: false,
      canReadInvitations: true,
    });
  });
});
