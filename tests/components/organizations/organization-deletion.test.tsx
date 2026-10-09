import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { cloneElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteAction: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { slug?: string }) =>
    key === "confirmLabel" ? `Type ${values?.slug} to confirm` : key,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/features/organizations/actions/delete-organization", () => ({
  deleteOrganizationAction: mocks.deleteAction,
}));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogTrigger: ({
    render,
    children,
  }: {
    render: React.ReactElement;
    children: React.ReactNode;
  }) => cloneElement(render, {}, children),
}));

import { OrganizationDeletionPanel } from "@/features/organizations/components/organization-deletion-panel";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deleteAction.mockResolvedValue({ success: true, data: { sessionCleanupPending: false } });
});

describe("organization deletion controls", () => {
  it("shows the destructive affordance only when the owner gate is granted", () => {
    const { rerender } = render(
      <OrganizationDeletionPanel organizationSlug="acme" canDelete={false} />
    );
    expect(screen.queryByRole("button", { name: "open" })).not.toBeInTheDocument();

    rerender(<OrganizationDeletionPanel organizationSlug="acme" canDelete />);
    expect(screen.getByRole("button", { name: "open" })).toBeInTheDocument();
  });

  it("enables confirmation only when the exact current slug is typed", async () => {
    render(<OrganizationDeletionPanel organizationSlug="acme" canDelete />);
    const confirm = screen.getByRole("button", { name: "confirm" });
    const input = screen.getByLabelText("Type acme to confirm");
    expect(confirm).toBeDisabled();

    fireEvent.change(input, { target: { value: "ACME" } });
    expect(confirm).toBeDisabled();
    fireEvent.change(input, { target: { value: "acme" } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(mocks.deleteAction).toHaveBeenCalledWith({ confirmation: "acme" }));
    expect(mocks.replace).toHaveBeenCalledWith("/org");
  });
});
