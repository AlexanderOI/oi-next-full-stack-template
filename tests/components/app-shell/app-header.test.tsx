import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pathname: "/org/alpha", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  usePathname: () => mocks.pathname,
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({
      dashboard: "Panel",
      members: "Members",
      invitations: "Invitations",
      profile: "Profile",
      roles: "Roles",
      users: "Users",
      organizations: "Organizations",
      breadcrumb: "Breadcrumb",
    })[key] ?? key,
}));
vi.mock("@/features/auth/client", () => ({ signOut: vi.fn() }));
vi.mock("@/features/organizations/client", () => ({
  OrganizationHeaderSelector: ({
    activeOrganizationId,
  }: {
    activeOrganizationId: string | null;
  }) => (
    <span data-testid="selector">
      {activeOrganizationId === "a" ? "Alpha" : "Select organization"}
    </span>
  ),
}));

import { AppHeader } from "@/features/app-shell/components/app-header";

const organizations = [{ id: "a", slug: "alpha", name: "Alpha" }];

beforeEach(() => {
  mocks.pathname = "/org/alpha";
  mocks.push.mockClear();
});

describe("app header breadcrumb", () => {
  it.each([
    ["/org/alpha", "Panel"],
    ["/org/alpha/members", "Members"],
    ["/org/alpha/invitations", "Invitations"],
    ["/profile", "Profile"],
    ["/admin/roles", "Roles"],
    ["/admin/users", "Users"],
  ])("shows verified organization and route label for %s", (path, label) => {
    mocks.pathname = path;
    render(<AppHeader organizations={organizations} activeOrganizationId="a" />);
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent(
      path === "/org/alpha" ? "oi-nextjs/Alpha/Panel" : `oi-nextjs/Alpha/Panel/${label}`
    );
    expect(screen.getByRole("link", { name: "Panel" })).toHaveAttribute("href", "/org/alpha");
  });

  it.each([null, "stale"])("does not expose inaccessible organization for %s", (id) => {
    mocks.pathname = "/org/alpha/members";
    render(<AppHeader organizations={organizations} activeOrganizationId={id} />);
    expect(screen.getByTestId("selector")).toHaveTextContent("Select organization");
    expect(screen.queryByRole("link", { name: "Panel" })).not.toBeInTheDocument();
  });
});
