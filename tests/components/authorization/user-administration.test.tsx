import { fireEvent, renderWithLocale, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { type OnUrlUpdateFunction, NuqsTestingAdapter } from "nuqs/adapters/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  inviteUser: vi.fn(),
  replaceUserRoles: vi.fn(),
  resendUserInvitation: vi.fn(),
  updateUserAccess: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));
vi.mock("@/features/authorization/actions/manage-user-invitations", () => ({
  inviteUser: mocks.inviteUser,
  resendUserInvitation: mocks.resendUserInvitation,
}));
vi.mock("@/features/authorization/actions/manage-user-roles", () => ({
  replaceUserRoles: mocks.replaceUserRoles,
}));
vi.mock("@/features/authorization/actions/manage-user-access", () => ({
  updateUserAccess: mocks.updateUserAccess,
}));
vi.mock("@/features/authorization/actions/manage-roles", () => ({
  createRole: vi.fn(),
  deleteRole: vi.fn(),
  updateRole: vi.fn(),
}));

import { UserAdministration, UserInvitationDialog } from "@/features/authorization/client";
import type {
  RoleSummary,
  UserAdministrationPermissions,
  UserRoleSummary,
} from "@/features/authorization/contracts";

const roles: RoleSummary[] = [
  {
    id: "admin-role",
    key: "admin",
    name: "Administrator",
    description: "Full administration",
    isSystem: true,
    permissions: [],
  },
  {
    id: "member-role",
    key: "member",
    name: "Member",
    description: "Standard access",
    isSystem: true,
    permissions: [],
  },
];

const permissions: UserAdministrationPermissions = {
  canInviteUsers: true,
  canManageRoles: true,
  canManageAccess: true,
};

const users: UserRoleSummary[] = [
  {
    id: "alice-id",
    name: "Alice Johnson with an intentionally long display name",
    email: "alice@example.com",
    emailVerified: true,
    username: "alice.johnson",
    invitedAt: null,
    disabledAt: null,
    roleIds: ["admin-role"],
  },
  {
    id: "bob-id",
    name: "Bob Smith",
    email: "bob@example.com",
    emailVerified: false,
    username: "bobby",
    invitedAt: new Date("2026-09-29T12:00:00.000Z"),
    disabledAt: null,
    roleIds: ["member-role"],
  },
  {
    id: "carol-id",
    name: "Carol Rivera",
    email: "carol@example.com",
    emailVerified: true,
    username: null,
    invitedAt: null,
    disabledAt: new Date("2026-09-28T12:00:00.000Z"),
    roleIds: ["member-role"],
  },
];

function renderAdministration(
  locale: "en" | "es" = "en",
  options: {
    permissions?: UserAdministrationPermissions;
    searchParams?: Record<string, string>;
  } = {}
) {
  const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
  const result = renderWithLocale(
    <NuqsTestingAdapter hasMemory onUrlUpdate={onUrlUpdate} searchParams={options.searchParams}>
      <UserAdministration
        actorUserId="alice-id"
        users={users}
        roles={
          locale === "es"
            ? roles.map((role) => ({
                ...role,
                name: role.key === "admin" ? "Administrador" : "Miembro",
              }))
            : roles
        }
        permissions={options.permissions ?? permissions}
      />
    </NuqsTestingAdapter>,
    locale
  );

  return { ...result, onUrlUpdate };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.inviteUser.mockResolvedValue({ success: true, data: { userId: "new-id" } });
  mocks.replaceUserRoles.mockResolvedValue({ success: true });
  mocks.resendUserInvitation.mockResolvedValue({ success: true, data: { userId: "bob-id" } });
  mocks.updateUserAccess.mockResolvedValue({
    success: true,
    data: { userId: "carol-id", status: "active", changed: true },
  });
});

describe("UserAdministration", () => {
  it("renders localized roles and lifecycle statuses with stable truncated columns", () => {
    const { container } = renderAdministration();

    expect(screen.getByText("Administrator")).toBeInTheDocument();
    expect(screen.getByText("Invitation pending")).toBeInTheDocument();
    expect(screen.getByText("Disabled")).toBeInTheDocument();
    expect(screen.getAllByText("Verified")).not.toHaveLength(0);
    expect(screen.getByRole("table")).toHaveStyle({ tableLayout: "fixed" });
    expect(
      Array.from(container.querySelectorAll("colgroup col"), (column) =>
        (column as HTMLElement).style.getPropertyValue("width")
      )
    ).toEqual(["28%", "15%", "22%", "15%", "12%", "8%"]);
    expect(screen.getByText(users[0].name)).toHaveClass("truncate");
  });

  it("localizes shared table menus and hides implementation-only columns", async () => {
    const user = userEvent.setup();
    renderAdministration("es");

    expect(screen.getByText("Filas por página")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filas por página" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir a la página 1" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Nombre y correo electrónico" }));

    expect(await screen.findByRole("menuitem", { name: "Orden ascendente" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Orden descendente" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Borrar orden" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Ocultar columna" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Columnas" }));

    expect(
      await screen.findByRole("menuitemcheckbox", { name: "Nombre y correo electrónico" })
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitemcheckbox", { name: "Nombre de usuario" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitemcheckbox", { name: "name" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitemcheckbox", { name: "search" })).not.toBeInTheDocument();
  });

  it("searches name, email, username, and localized role labels and distinguishes filtered empty", () => {
    renderAdministration("es");
    const search = screen.getByRole("searchbox", { name: "Buscar usuarios" });

    fireEvent.change(search, { target: { value: "bobby" } });
    expect(screen.getByText("Bob Smith")).toBeInTheDocument();
    expect(screen.queryByText("Carol Rivera")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "carol@example.com" } });
    expect(screen.getByText("Carol Rivera")).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "alice johnson" } });
    expect(screen.getByText(users[0].name)).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "Administrador" } });
    expect(screen.getByText(users[0].name)).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "nobody@example.com" } });
    expect(screen.getByText("Ningún usuario coincide con la búsqueda.")).toBeInTheDocument();
  });

  it("honors URL-backed sorting and pagination through the shared table", async () => {
    const pagedUsers = Array.from({ length: 11 }, (_, index) => ({
      ...users[0],
      id: `user-${index}`,
      name: `User ${String(index).padStart(2, "0")}`,
      email: `user-${index}@example.com`,
    }));
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();

    renderWithLocale(
      <NuqsTestingAdapter
        hasMemory
        onUrlUpdate={onUrlUpdate}
        searchParams={{
          page: "1",
          perPage: "10",
          sort: JSON.stringify([{ id: "name", desc: true }]),
        }}
      >
        <UserAdministration
          actorUserId="actor-id"
          users={pagedUsers}
          roles={roles}
          permissions={permissions}
        />
      </NuqsTestingAdapter>,
      "en"
    );

    expect(screen.getByText("User 10")).toBeInTheDocument();
    expect(screen.queryByText("User 00")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Go to next page" }));
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get("page")).toBe("2");
  });

  it("shows only authorized controls and keeps invitation/access constraints visible", async () => {
    const user = userEvent.setup();
    renderAdministration();

    expect(
      screen.getByRole("button", { name: `Actions for ${users[0].name}` })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Actions for Bob Smith" }));
    expect(await screen.findByRole("menuitem", { name: "Edit roles" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Resend invitation" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Disable user" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Resend invitation" }));
    await waitFor(() => expect(mocks.resendUserInvitation).toHaveBeenCalledWith("bob-id"));
    expect(mocks.refresh).toHaveBeenCalledOnce();

    renderAdministration("en", {
      permissions: {
        canInviteUsers: false,
        canManageRoles: false,
        canManageAccess: false,
      },
    });
    expect(screen.getAllByText("No actions available")).not.toHaveLength(0);
  });

  it("updates roles and access through protected actions, then refreshes successful results", async () => {
    const user = userEvent.setup();
    renderAdministration();

    await user.click(screen.getByRole("button", { name: "Actions for Carol Rivera" }));
    await user.click(await screen.findByRole("menuitem", { name: "Edit roles" }));
    await user.click(await screen.findByRole("checkbox", { name: "Administrator" }));
    await user.click(screen.getByRole("button", { name: "Save roles" }));
    await waitFor(() =>
      expect(mocks.replaceUserRoles).toHaveBeenCalledWith({
        userId: "carol-id",
        roleIds: expect.arrayContaining(["admin-role", "member-role"]),
      })
    );

    await user.click(screen.getByRole("button", { name: "Actions for Carol Rivera" }));
    await user.click(await screen.findByRole("menuitem", { name: "Reactivate user" }));
    await user.click(await screen.findByRole("button", { name: "Reactivate" }));
    await waitFor(() =>
      expect(mocks.updateUserAccess).toHaveBeenCalledWith({
        userId: "carol-id",
        status: "active",
      })
    );
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
  });

  it("shows the localized signed-out message when a role update is unauthorized", async () => {
    mocks.replaceUserRoles.mockResolvedValueOnce({ success: false, code: "UNAUTHORIZED" });
    const user = userEvent.setup();
    renderAdministration();

    await user.click(screen.getByRole("button", { name: "Actions for Carol Rivera" }));
    await user.click(await screen.findByRole("menuitem", { name: "Edit roles" }));
    await user.click(await screen.findByRole("checkbox", { name: "Administrator" }));
    await user.click(screen.getByRole("button", { name: "Save roles" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "You must be signed in to perform this action."
      )
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("localizes unauthorized and forbidden protected-action outcomes without refreshing", async () => {
    mocks.resendUserInvitation.mockResolvedValueOnce({ success: false, code: "UNAUTHORIZED" });
    mocks.updateUserAccess.mockResolvedValueOnce({ success: false, code: "FORBIDDEN" });
    const user = userEvent.setup();
    renderAdministration();

    await user.click(screen.getByRole("button", { name: "Actions for Bob Smith" }));
    await user.click(await screen.findByRole("menuitem", { name: "Resend invitation" }));
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("You must be signed in to perform this action.")
    );

    await user.click(screen.getByRole("button", { name: "Actions for Carol Rivera" }));
    await user.click(await screen.findByRole("menuitem", { name: "Reactivate user" }));
    await user.click(await screen.findByRole("button", { name: "Reactivate" }));
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "You do not have permission to perform this action."
      )
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

describe("UserInvitationDialog", () => {
  it("submits a localized invitation only when invite permission is present", async () => {
    const user = userEvent.setup();
    renderWithLocale(<UserInvitationDialog canInviteUsers />, "es");

    await user.click(screen.getByRole("button", { name: "Invitar usuario" }));
    await user.type(screen.getByLabelText("Nombre"), "New User");
    await user.type(screen.getByLabelText("Correo electrónico"), "new@example.com");
    await user.type(screen.getByLabelText("Nombre de usuario"), "new.user");
    await user.click(screen.getByRole("button", { name: "Enviar invitación" }));

    await waitFor(() =>
      expect(mocks.inviteUser).toHaveBeenCalledWith({
        name: "New User",
        email: "new@example.com",
        username: "new.user",
        locale: "es",
      })
    );
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("keeps the generic invitation failure localized", async () => {
    mocks.inviteUser.mockResolvedValueOnce({ success: false, code: "INVITATION_FAILED" });
    const user = userEvent.setup();
    renderWithLocale(<UserInvitationDialog canInviteUsers />, "en");

    await user.click(screen.getByRole("button", { name: "Invite user" }));
    await user.type(screen.getByLabelText("Name"), "New User");
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Username"), "new.user");
    await user.click(screen.getByRole("button", { name: "Send invitation" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("The invitation could not be created.")
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
