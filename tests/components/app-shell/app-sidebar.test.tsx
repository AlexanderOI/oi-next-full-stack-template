import { cleanup, renderInEnglish as render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { AppSidebar } from "@/features/app-shell/components/app-sidebar";
import { AuthorizationProvider } from "@/features/authorization/components/authorization-provider";
import { PERMISSIONS, type PermissionKey } from "@/features/authorization/contracts";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("@/features/authorization/client", async () => {
  const [{ Permission }, { PERMISSIONS }] = await Promise.all([
    import("@/features/authorization/components/authorization-provider"),
    import("@/features/authorization/contracts"),
  ]);

  return { Permission, PERMISSIONS };
});
vi.mock("@/features/app-shell/actions/sidebar-preference", () => ({
  setSidebarCollapsed: vi.fn(),
}));

function renderSidebar(
  permissions: readonly PermissionKey[],
  organizationNavigation: {
    slug: string;
    canReadMembers: boolean;
    canReadInvitations: boolean;
  } | null = null
) {
  return render(
    <AuthorizationProvider snapshot={{ userId: "u1", roles: ["member"], permissions }}>
      <AppSidebar initialCollapsed={false} organizationNavigation={organizationNavigation} />
    </AuthorizationProvider>
  );
}

describe("AppSidebar", () => {
  it("shows only administration destinations granted to the user", () => {
    renderSidebar([PERMISSIONS.ROLES_READ]);

    expect(screen.getByText("Administration")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Roles" })).toHaveAttribute("href", "/admin/roles");
    expect(screen.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();

    cleanup();
    renderSidebar([PERMISSIONS.USERS_READ]);

    expect(screen.getByRole("link", { name: "Users" })).toHaveAttribute("href", "/admin/users");
    expect(screen.queryByRole("link", { name: "Roles" })).not.toBeInTheDocument();
  });

  it("hides the complete administration section without administration permissions", () => {
    renderSidebar([]);

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.queryByText("Administration")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Roles" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
  });

  it("offers the chooser without an active organization", () => {
    renderSidebar([]);
    expect(screen.getByRole("link", { name: "Organizations" })).toHaveAttribute("href", "/org");
    expect(screen.queryByRole("link", { name: "Workspace" })).not.toBeInTheDocument();
  });

  it("shows owner workspace and scoped destinations without platform administration", () => {
    renderSidebar([], { slug: "alpha", canReadMembers: true, canReadInvitations: true });
    expect(screen.getByRole("link", { name: "Workspace" })).toHaveAttribute("href", "/org/alpha");
    expect(screen.getByRole("link", { name: "Members" })).toHaveAttribute(
      "href",
      "/org/alpha/members"
    );
    expect(screen.getByRole("link", { name: "Invitations" })).toHaveAttribute(
      "href",
      "/org/alpha/invitations"
    );
    expect(screen.queryByText("Administration")).not.toBeInTheDocument();
  });

  it("keeps partial organization grants separate from platform grants", () => {
    renderSidebar([PERMISSIONS.ROLES_READ], {
      slug: "alpha",
      canReadMembers: false,
      canReadInvitations: true,
    });
    expect(screen.queryByRole("link", { name: "Members" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Invitations" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Roles" })).toBeInTheDocument();
    cleanup();
    renderSidebar([PERMISSIONS.ROLES_READ]);
    expect(screen.queryByRole("link", { name: "Workspace" })).not.toBeInTheDocument();
  });
});
