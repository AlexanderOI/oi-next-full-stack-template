import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ push: vi.fn(), switchOrganization: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/features/organizations/actions/switch-organization", () => ({
  switchOrganization: mocks.switchOrganization,
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({
      selectOrganization: "Select organization",
      switchingOrganization: "Switching organization",
      organizationUnavailable: "Organization unavailable",
    })[key] ?? key,
}));

import { OrganizationHeaderSelector } from "@/features/organizations/components/organization-header-selector";

const organizations = [
  { id: "a", slug: "alpha", name: "Alpha" },
  { id: "b", slug: "bravo", name: "Bravo" },
];

beforeEach(() => vi.clearAllMocks());

async function chooseBravo() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: "Select organization" }));
  await user.click(await screen.findByRole("option", { name: "Bravo" }));
}

describe("header organization selector", () => {
  it.each([null, "stale"])("does not implicitly select for %s", (activeOrganizationId) => {
    render(
      <OrganizationHeaderSelector
        organizations={organizations}
        activeOrganizationId={activeOrganizationId}
      />
    );
    expect(screen.getByRole("combobox", { name: "Select organization" })).toHaveTextContent(
      "Select organization"
    );
    expect(mocks.switchOrganization).not.toHaveBeenCalled();
  });

  it("disables selection when no memberships are available", () => {
    render(<OrganizationHeaderSelector organizations={[]} activeOrganizationId={null} />);
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("uses the action's canonical destination on explicit selection", async () => {
    mocks.switchOrganization.mockResolvedValue({ success: true, href: "/org/bravo" });
    render(<OrganizationHeaderSelector organizations={organizations} activeOrganizationId="a" />);
    await chooseBravo();
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/org/bravo"));
    expect(mocks.switchOrganization).toHaveBeenCalledWith("b");
  });

  it("reports rejected selection without navigation", async () => {
    mocks.switchOrganization.mockResolvedValue({ success: false });
    render(<OrganizationHeaderSelector organizations={organizations} activeOrganizationId="a" />);
    await chooseBravo();
    expect(await screen.findByRole("alert")).toHaveTextContent("Organization unavailable");
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
