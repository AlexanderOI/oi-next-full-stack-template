import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  switchOrganization: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, replace: vi.fn() }) }));
vi.mock("@/features/organizations/actions/switch-organization", () => ({
  switchOrganization: mocks.switchOrganization,
}));

import { OrganizationContextChoice } from "@/features/organizations/components/organization-context-choice";
import { OrganizationSwitcher } from "@/features/organizations/components/organization-switcher";

const organizations = [
  { id: "org-a", slug: "alpha", name: "Alpha" },
  { id: "org-b", slug: "bravo", name: "Bravo" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.switchOrganization.mockResolvedValue({ success: true, href: "/org/bravo" });
});

describe("organization selection controls", () => {
  it("shows only supplied active memberships and switches only after explicit selection", async () => {
    render(<OrganizationSwitcher organizations={organizations} activeOrganizationId="org-a" />);
    expect(screen.getByRole("button", { name: "Alpha" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Bravo" })).toBeInTheDocument();
    expect(screen.queryByText("Secret organization")).not.toBeInTheDocument();
    expect(mocks.switchOrganization).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Bravo" }));
    expect(mocks.switchOrganization).toHaveBeenCalledWith("org-b");
  });

  it("offers explicit switch and return choices on mismatch without silently changing context", () => {
    render(
      <OrganizationContextChoice
        target={{ organizationId: "org-b", organizationSlug: "bravo", organizationName: "Bravo" }}
        active={{ organizationId: "org-a", organizationSlug: "alpha", organizationName: "Alpha" }}
      />
    );
    expect(screen.getByRole("button", { name: "Switch to Bravo" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Alpha" })).toHaveAttribute("href", "/org/alpha");
    expect(mocks.switchOrganization).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Switch to Bravo" }));
    expect(mocks.switchOrganization).toHaveBeenCalledWith("org-b");
  });
});
