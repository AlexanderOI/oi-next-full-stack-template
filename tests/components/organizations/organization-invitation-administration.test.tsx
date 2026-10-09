import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  resend: vi.fn(),
  cancel: vi.fn(),
  refresh: vi.fn(),
  options: undefined as unknown,
  locale: "en",
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => (mocks.locale === "es" ? `es:${key}` : key),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("nuqs", () => ({
  useQueryState: (_key: string, options?: { defaultValue?: string }) => [
    options?.defaultValue ?? "",
    vi.fn(),
  ],
}));
vi.mock("@/components/ui/data-table", () => ({
  DataTable: ({
    toolbar,
    labels,
  }: {
    toolbar: React.ReactNode;
    labels: Record<string, unknown>;
  }) => (
    <div>
      {toolbar}
      <span>{labels.rowsPerPage as React.ReactNode}</span>
      <span>{(labels.goToPage as (page: number) => string)(2)}</span>
      <button
        onClick={() => {
          const table = mocks.options as {
            columns: Array<{
              id?: string;
              cell?: (context: { row: { original: unknown } }) => React.ReactNode;
            }>;
            data: unknown[];
          };
          const actions = table.columns.find((column) => column.id === "actions");
          const cell = actions?.cell?.({ row: { original: table.data[0] } });
          if (cell && typeof cell === "object" && "props" in cell) {
            const children = (cell.props as { children: React.ReactNode[] }).children;
            const resend = children.find(
              (child) =>
                child &&
                typeof child === "object" &&
                "props" in child &&
                (child.props as { children?: React.ReactNode }).children === "resend"
            );
            if (resend && typeof resend === "object" && "props" in resend)
              (resend.props as { onClick: () => void }).onClick();
          }
        }}
      >
        trigger resend
      </button>
    </div>
  ),
  DataTableToolbar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  createDataTableParsers: () => ({ page: {} }),
  useDataTable: (options: unknown) => {
    mocks.options = options;
    return {};
  },
}));
vi.mock("@/components/ui/input", () => ({
  Input: (props: React.ComponentProps<"input">) => <input {...props} />,
}));
vi.mock("@/components/ui/button", () => ({
  Button: (props: React.ComponentProps<"button">) => <button {...props} />,
}));
vi.mock("@/components/ui/label", () => ({
  Label: (props: React.ComponentProps<"label">) => <label {...props} />,
}));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
}));
vi.mock("@/features/organizations/actions/organization-invitations", () => ({
  createOrganizationInvitation: mocks.create,
  resendOrganizationInvitation: mocks.resend,
  cancelOrganizationInvitation: mocks.cancel,
}));

import { OrganizationInvitationAdministration } from "@/features/organizations/components/organization-invitation-administration";

const invitationId = "secret-capability-token";
const data = {
  rows: [
    {
      id: invitationId,
      email: "person@example.com",
      roleId: "role-member-id",
      roleName: "Member",
      status: "pending",
      effectiveStatus: "pending" as const,
      expiresAt: new Date("2030-01-03T00:00:00.000Z"),
      createdAt: new Date("2030-01-01T00:00:00.000Z"),
    },
  ],
  roles: [
    { id: "role-owner-id", key: "owner", name: "Owner", isProtected: true },
    { id: "role-member-id", key: "member", name: "Member", isProtected: true },
    { id: "role-custom-id", key: "analyst", name: "Analyst", isProtected: false },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
};

function renderAdmin(
  overrides: Partial<React.ComponentProps<typeof OrganizationInvitationAdministration>> = {}
) {
  return render(
    <OrganizationInvitationAdministration
      data={data}
      canCreate
      canResend
      canCancel
      canTransferOwnership={false}
      {...overrides}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.locale = "en";
  mocks.create.mockResolvedValue({
    success: true,
    data: { invitationId, expiresAt: "2030-01-03T00:00:00.000Z" },
  });
  mocks.resend.mockResolvedValue({
    success: false,
    code: "INVITATION_DELIVERY_FAILED",
    invitationId,
  });
  mocks.cancel.mockResolvedValue({ success: true, data: { invitationId } });
});

describe("organization invitation administration", () => {
  it("uses the reusable table, hides capability IDs from visible text, and omits owner without transfer permission", () => {
    renderAdmin();
    expect(screen.getByText("title")).toBeInTheDocument();
    expect(screen.queryByText(invitationId)).not.toBeInTheDocument();
    const roleSelect = screen.getByLabelText("role") as HTMLSelectElement;
    expect(Array.from(roleSelect.options).map((option) => option.value)).toEqual([
      "role-member-id",
      "role-custom-id",
    ]);
  });

  it("offers owner only with ownership-transfer permission and selects by role ID", async () => {
    renderAdmin({ canTransferOwnership: true });
    const roleSelect = screen.getByLabelText("role") as HTMLSelectElement;
    expect(Array.from(roleSelect.options).map((option) => option.value)).toContain("role-owner-id");
    fireEvent.change(roleSelect, { target: { value: "role-custom-id" } });
    fireEvent.change(screen.getByLabelText("email"), {
      target: { value: "recipient@example.com" },
    });
    fireEvent.submit(screen.getByLabelText("email").closest("form")!);
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith({
        email: "recipient@example.com",
        roleId: "role-custom-id",
      })
    );
  });

  it("reports a create delivery failure immediately and refreshes the retained pending row", async () => {
    mocks.create.mockResolvedValue({
      success: false,
      code: "INVITATION_DELIVERY_FAILED",
      invitationId,
      expiresAt: "2030-01-03T00:00:00.000Z",
    });
    renderAdmin();
    fireEvent.change(screen.getByLabelText("email"), {
      target: { value: "recipient@example.com" },
    });
    fireEvent.submit(screen.getByLabelText("email").closest("form")!);
    expect(await screen.findByText("deliveryFailed")).toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("gates row actions by permissions and reports delivery failures without losing the pending row", async () => {
    renderAdmin({ canCreate: false, canResend: false, canCancel: false });
    const table = mocks.options as { columns: Array<{ id?: string }> };
    expect(table.columns.some(({ id }) => id === "actions")).toBe(false);
    expect(screen.queryByText("create")).not.toBeInTheDocument();

    renderAdmin({ canCreate: false, canResend: true, canCancel: false });
    fireEvent.click(screen.getAllByRole("button", { name: "trigger resend" })[1]);
    await waitFor(() => expect(mocks.resend).toHaveBeenCalledWith({ invitationId }));
    expect(await screen.findByText("deliveryFailed")).toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("localizes status labels and table chrome through the invitation namespace", () => {
    mocks.locale = "es";
    renderAdmin();
    expect(screen.getByText("es:title")).toBeInTheDocument();
    expect(screen.getByText("es:dataTable.rowsPerPage")).toBeInTheDocument();
  });
});
