import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Children, isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resend: vi.fn(),
  updateAccess: vi.fn(),
  transferOwnership: vi.fn(),
  provision: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  removeMember: vi.fn(),
  leave: vi.fn(),
  tableOptions: undefined as unknown,
  restrictionProps: undefined as unknown,
  locale: "en",
  tableLabels: undefined as unknown,
  toolbarLabels: undefined as unknown,
}));
function findClickTarget(
  node: React.ReactNode
): React.ReactElement<{ onClick?: () => void }> | undefined {
  if (!isValidElement<{ children?: React.ReactNode; onClick?: () => void }>(node)) return undefined;
  if (typeof node.props.onClick === "function") {
    return node as React.ReactElement<{ onClick: () => void }>;
  }
  for (const child of Children.toArray(node.props.children)) {
    const target = findClickTarget(child);
    if (target) return target;
  }
  return undefined;
}

const spanishLabels: Record<string, string> = {
  title: "Miembros de la organización",
  search: "Buscar miembros",
  columns: "Columnas",
  rowsPerPage: "Filas por página",
  goToPage: "Ir a la página {page}",
  sortAscending: "Orden ascendente",
  sortDescending: "Orden descendente",
  clearSorting: "Quitar orden",
  hideColumn: "Ocultar columna",
  name: "Nombre",
  email: "Correo electrónico",
  username: "Nombre de usuario",
  status: "Estado de membresía",
  statusActive: "Activo",
  statusSuspended: "Suspendido",
  roles: "Roles",
  created: "Se unió",
  activation: "Activación",
  activationPending: "Activación pendiente",
  activationComplete: "Activado",
  resend: "Reenviar activación",
  actions: "Acciones",
  "dataTable.columns": "Columnas",
  "dataTable.rowsPerPage": "Filas por página",
  "dataTable.goToPage": "Ir a la página {page}",
  "dataTable.sortAscending": "Orden ascendente",
  "dataTable.sortDescending": "Orden descendente",
  "dataTable.clearSorting": "Quitar orden",
  "dataTable.hideColumn": "Ocultar columna",
  "dataTable.columnLabels.name": "Nombre",
  "dataTable.columnLabels.email": "Correo electrónico",
  "dataTable.columnLabels.username": "Nombre de usuario",
  "dataTable.columnLabels.status": "Estado de membresía",
  "dataTable.columnLabels.roles": "Roles",
  "dataTable.columnLabels.createdAt": "Se unió",
  "dataTable.columnLabels.activation": "Activación",
  "dataTable.columnLabels.actions": "Acciones",
};
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { page: number }) => {
    const translation = mocks.locale === "es" ? spanishLabels[key] : undefined;
    return translation?.replace("{page}", String(values?.page)) ?? key;
  },
  useLocale: () => mocks.locale,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace }),
}));
vi.mock("nuqs", () => ({ useQueryState: () => ["", vi.fn()] }));
vi.mock("@/components/ui/data-table", () => ({
  DataTable: ({
    toolbar,
    labels,
  }: {
    toolbar: React.ReactNode;
    labels?: Record<string, unknown>;
  }) => {
    mocks.tableLabels = labels;
    return (
      <div>
        {toolbar}
        <span>{labels?.rowsPerPage as React.ReactNode}</span>
        <span>{(labels?.goToPage as ((page: number) => string) | undefined)?.(2)}</span>
        <button
          onClick={() => {
            const options = mocks.tableOptions as
              | {
                  columns: Array<{
                    id?: string;
                    cell?: (context: { row: { original: unknown } }) => React.ReactNode;
                  }>;
                  data: unknown[];
                }
              | undefined;
            const action = options?.columns.find((column) => column.id === "actions");
            const cell = action?.cell?.({ row: { original: options?.data[0] } });
            findClickTarget(cell)?.props.onClick?.();
          }}
        >
          trigger row action
        </button>
      </div>
    );
  },
  DataTableToolbar: ({
    children,
    labels,
  }: {
    children: React.ReactNode;
    labels?: Record<string, unknown>;
  }) => {
    mocks.toolbarLabels = labels;
    return (
      <div>
        {labels?.columns as React.ReactNode}
        {children}
      </div>
    );
  },
  createDataTableParsers: () => ({}),
  useDataTable: (options: unknown) => {
    mocks.tableOptions = options;
    return {};
  },
}));
vi.mock("@/components/ui/input", () => ({
  Input: (props: React.ComponentProps<"input">) => <input {...props} />,
}));
vi.mock("@/components/ui/button", () => ({
  Button: (props: React.ComponentProps<"button">) => <button {...props} />,
}));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogTrigger: ({
    children,
    render,
  }: {
    children: React.ReactNode;
    render?: React.ReactNode;
  }) => (
    <>
      {render}
      {children}
    </>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));
vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
  }: {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange(event.currentTarget.checked)}
    />
  ),
}));
vi.mock("@/components/ui/label", () => ({
  Label: (props: React.ComponentProps<"label">) => <label {...props} />,
}));
vi.mock("@/features/organizations/actions/admin-provisioning", () => ({
  resendOrganizationMemberActivation: mocks.resend,
  provisionOrganizationMember: mocks.provision,
}));
vi.mock("@/features/organizations/actions/manage-organization-members", () => ({
  updateOrganizationMemberAccess: mocks.updateAccess,
  transferOrganizationOwnership: mocks.transferOwnership,
  removeOrganizationMember: mocks.removeMember,
  leaveOrganization: mocks.leave,
}));
import { OrganizationMemberAdministration } from "@/features/organizations/components/organization-member-administration";
import { TransferOrganizationOwnershipDialog } from "@/features/organizations/components/transfer-organization-ownership-dialog";

const data = {
  rows: [
    {
      id: "member-1",
      userId: "user-1",
      name: "Sam",
      email: "sam@example.com",
      username: "sam",
      status: "active" as const,
      createdAt: new Date("2026-01-01"),
      activationState: "pending" as const,
      roles: [],
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.locale = "en";
  mocks.leave.mockResolvedValue({ success: true, data: { identityDeleted: false } });
  mocks.removeMember.mockResolvedValue({ success: true, data: { identityDeleted: false } });
  mocks.resend.mockResolvedValue({ success: true, data: { userId: "user-1" } });
  mocks.updateAccess.mockResolvedValue({
    success: true,
    data: { memberId: "member-1", status: "suspended", changed: true, identityDisabled: false },
  });
  mocks.transferOwnership.mockResolvedValue({ success: true, data: { changed: true } });
});

describe("organization member administration", () => {
  it("localizes table chrome and reusable table labels in Spanish", () => {
    mocks.locale = "es";
    render(
      <OrganizationMemberAdministration
        data={data}
        canProvision={false}
        canCreateRestriction={false}
      />
    );
    expect(screen.getByText("Miembros de la organización")).toBeInTheDocument();
    expect(screen.getByText("Columnas")).toBeInTheDocument();
    expect(screen.getByText("Filas por página")).toBeInTheDocument();
    expect(screen.getByText("Ir a la página 2")).toBeInTheDocument();
    expect(mocks.tableLabels).toMatchObject({
      columns: "Columnas",
      rowsPerPage: "Filas por página",
      sortAscending: "Orden ascendente",
      sortDescending: "Orden descendente",
      clearSorting: "Quitar orden",
      hideColumn: "Ocultar columna",
      columnLabels: {
        name: "Nombre",
        email: "Correo electrónico",
        username: "Nombre de usuario",
        status: "Estado de membresía",
        roles: "Roles",
        createdAt: "Se unió",
        activation: "Activación",
        actions: "Acciones",
      },
    });
    expect(mocks.toolbarLabels).toEqual(mocks.tableLabels);
  });

  it("hides access and transfer controls without their respective permissions", () => {
    render(
      <OrganizationMemberAdministration
        data={data}
        canProvision={false}
        canCreateRestriction={false}
      />
    );
    expect(screen.queryByRole("button", { name: "transfer" })).not.toBeInTheDocument();
    const options = mocks.tableOptions as { columns: Array<{ id?: string }> };
    expect(options.columns.some(({ id }) => id === "actions")).toBe(false);
  });

  it("shows self-leave without remove permission and routes after final identity deletion", async () => {
    mocks.leave.mockResolvedValue({ success: true, data: { identityDeleted: true } });
    render(
      <OrganizationMemberAdministration
        data={data}
        canProvision={false}
        canCreateRestriction={false}
        actorUserId="user-1"
      />
    );
    const options = mocks.tableOptions as {
      columns: Array<{
        id?: string;
        cell?: (context: { row: { original: (typeof data.rows)[number] } }) => React.ReactNode;
      }>;
    };
    const actions = options.columns.find(({ id }) => id === "actions");
    const { rerender } = render(<>{actions?.cell?.({ row: { original: data.rows[0]! } })}</>);
    expect(screen.getAllByText("leave").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "leave" })[0]!);
    await waitFor(() => expect(mocks.leave).toHaveBeenCalled());
    expect(await screen.findByText("identityDeletedFeedback")).toBeInTheDocument();
    expect(mocks.replace).toHaveBeenCalledWith("/auth/sign-in?accountRemoved=1");
    rerender(<>{actions?.cell?.({ row: { original: data.rows[0]! } })}</>);
  });

  it("gates removing another member behind the remove permission", () => {
    const other = { ...data.rows[0]!, userId: "other-user" };
    const { rerender } = render(
      <OrganizationMemberAdministration
        data={{ ...data, rows: [other] }}
        canProvision={false}
        canCreateRestriction={false}
        actorUserId="actor-user"
      />
    );
    const getAction = () => {
      const options = mocks.tableOptions as {
        columns: Array<{
          id?: string;
          cell?: (context: { row: { original: typeof other } }) => React.ReactNode;
        }>;
      };
      return options.columns.find(({ id }) => id === "actions");
    };
    const action = getAction();
    const { rerender: rerenderCell } = render(<>{action?.cell?.({ row: { original: other } })}</>);
    expect(screen.queryByRole("button", { name: "remove" })).not.toBeInTheDocument();
    rerender(
      <OrganizationMemberAdministration
        data={{ ...data, rows: [other] }}
        canProvision={false}
        canCreateRestriction={false}
        canRemoveMembers
        actorUserId="actor-user"
      />
    );
    const enabled = getAction();
    rerenderCell(<>{enabled?.cell?.({ row: { original: other } })}</>);
    expect(screen.getByRole("button", { name: "remove" })).toBeInTheDocument();
  });

  it("offers only a different active member as an ownership transfer recipient", () => {
    const rows = [
      { ...data.rows[0], id: "actor-member", name: "Actor" },
      { ...data.rows[0], id: "recipient-member", userId: "recipient", name: "Recipient" },
      { ...data.rows[0], id: "suspended-member", status: "suspended" as const, name: "Suspended" },
    ];
    render(<TransferOrganizationOwnershipDialog rows={rows} actorMembershipId="actor-member" />);
    const select = screen.getByRole("combobox", { name: "transferRecipient" });
    expect(select).toHaveTextContent("Recipient");
    expect(select).not.toHaveTextContent("Actor");
    expect(select).not.toHaveTextContent("Suspended");
  });

  it("hides provision and resend controls without provision permission", () => {
    render(
      <OrganizationMemberAdministration
        data={data}
        canProvision={false}
        canCreateRestriction={false}
      />
    );
    expect(screen.queryByText("provision")).not.toBeInTheDocument();
    const options = mocks.tableOptions as { columns: Array<{ id?: string }> };
    expect(options.columns.some(({ id }) => id === "actions")).toBe(false);
  });

  it("hides the restricted-mode choice without restriction-create permission", () => {
    render(
      <OrganizationMemberAdministration data={data} canProvision canCreateRestriction={false} />
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("gates identity status and access actions behind access-management permission", () => {
    const rows = {
      ...data,
      rows: data.rows.map((row) => ({ ...row, identityDisabled: true })),
    };
    const { rerender } = render(
      <OrganizationMemberAdministration
        data={rows}
        canProvision={false}
        canCreateRestriction={false}
      />
    );
    expect(screen.queryByText("identityDisabled")).not.toBeInTheDocument();
    rerender(
      <OrganizationMemberAdministration
        data={rows}
        canProvision={false}
        canCreateRestriction={false}
        canManageAccess
      />
    );
    const options = mocks.tableOptions as {
      data: typeof rows.rows;
      columns: Array<{
        id?: string;
        accessorKey?: string;
        cell?: (context: { row: { original: (typeof rows.rows)[number] } }) => React.ReactNode;
      }>;
    };
    expect(options.data[0]?.identityDisabled).toBe(true);
    expect(options.columns.some(({ id }) => id === "actions")).toBe(true);
    const statusColumn = options.columns.find((column) => column.accessorKey === "status");
    const { container } = render(
      <>{statusColumn?.cell?.({ row: { original: options.data[0]! } })}</>
    );
    expect(container).toHaveTextContent("identityDisabled");
  });

  it("resends activation using the row identity", async () => {
    render(
      <OrganizationMemberAdministration data={data} canProvision canCreateRestriction={false} />
    );
    fireEvent.click(screen.getByRole("button", { name: "trigger row action" }));
    await waitFor(() => expect(mocks.resend).toHaveBeenCalledWith("user-1"));
    expect(await screen.findByText("resendSuccess")).toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("does not offer activation resend for a suspended pending row", () => {
    const suspendedData = {
      ...data,
      rows: data.rows.map((row) => ({ ...row, status: "suspended" as const })),
    };
    render(
      <OrganizationMemberAdministration
        data={suspendedData}
        canProvision
        canCreateRestriction={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "trigger row action" }));
    expect(mocks.resend).not.toHaveBeenCalled();
  });

  it("submits restricted provisioning and safely reports delivery failure", async () => {
    mocks.provision.mockResolvedValue({
      success: false,
      code: "INVITATION_DELIVERY_FAILED",
      pendingUserId: "new-user",
    });
    render(<OrganizationMemberAdministration data={data} canProvision canCreateRestriction />);
    fireEvent.change(screen.getByLabelText("name"), { target: { value: "Alex Example" } });
    fireEvent.change(screen.getByLabelText("email"), { target: { value: "alex@example.com" } });
    fireEvent.change(screen.getByLabelText("username"), { target: { value: "alex" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(screen.getByLabelText("email").closest("form")!);
    await waitFor(() =>
      expect(mocks.provision).toHaveBeenCalledWith({
        name: "Alex Example",
        email: "alex@example.com",
        username: "alex",
        locale: "en",
        restricted: true,
      })
    );
    expect(await screen.findByText("deliveryFailed")).toBeInTheDocument();
  });
});
