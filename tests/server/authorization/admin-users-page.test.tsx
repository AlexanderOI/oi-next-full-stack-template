import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertPermission: vi.fn(),
  getAuthorizationSnapshot: vi.fn(),
  listLocalizedRoles: vi.fn(),
  listUsersWithRoles: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect.mockImplementation((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(
    async () => (key: string) =>
      ({ title: "Users", description: "Manage application users", empty: "No users found." })[
        key
      ] ?? key
  ),
}));
vi.mock("@/features/authorization/server", () => ({
  assertPermission: mocks.assertPermission,
  getAuthorizationSnapshot: mocks.getAuthorizationSnapshot,
  listLocalizedRoles: mocks.listLocalizedRoles,
  listUsersWithRoles: mocks.listUsersWithRoles,
  PERMISSIONS: {
    USERS_READ: "authorization.users.read",
    USERS_INVITE: "authorization.users.invite",
    USER_ROLES_UPDATE: "authorization.user-roles.update",
    USER_ACCESS_UPDATE: "authorization.user-access.update",
  },
}));
vi.mock("@/features/authorization/client", () => ({
  UserInvitationDialog: ({ canInviteUsers }: { canInviteUsers: boolean }) => (
    <div data-testid="invite-control">{String(canInviteUsers)}</div>
  ),
  UserAdministration: ({
    actorUserId,
    users,
    permissions,
  }: {
    actorUserId: string;
    users: unknown[];
    permissions: Record<string, boolean>;
  }) => (
    <div
      data-testid="user-administration"
      data-actor={actorUserId}
      data-count={users.length}
      data-permissions={JSON.stringify(permissions)}
    />
  ),
}));

import UsersPage from "@/app/(app)/admin/users/page";

describe("admin users page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertPermission.mockResolvedValue(undefined);
    mocks.getAuthorizationSnapshot.mockResolvedValue({
      userId: "admin-id",
      roles: ["admin"],
      permissions: [
        "authorization.users.read",
        "authorization.users.invite",
        "authorization.user-roles.update",
      ],
    });
    mocks.listLocalizedRoles.mockResolvedValue([{ id: "member-role", name: "Member" }]);
    mocks.listUsersWithRoles.mockResolvedValue([{ id: "user-id", name: "User" }]);
  });

  it("authorizes and performs initial reads before composing serializable permissions beneath PageHeader", async () => {
    render(await UsersPage());

    expect(mocks.assertPermission).toHaveBeenCalledWith("authorization.users.read");
    expect(mocks.listLocalizedRoles).toHaveBeenCalledOnce();
    expect(mocks.listUsersWithRoles).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { name: "Users" })).toBeInTheDocument();
    expect(screen.getByTestId("invite-control")).toHaveTextContent("true");
    expect(screen.getByTestId("user-administration")).toHaveAttribute("data-actor", "admin-id");
    expect(screen.getByTestId("user-administration")).toHaveAttribute(
      "data-permissions",
      JSON.stringify({
        canInviteUsers: true,
        canManageRoles: true,
        canManageAccess: false,
      })
    );
  });

  it("retains a distinct defensive true-empty state", async () => {
    mocks.listUsersWithRoles.mockResolvedValue([]);

    render(await UsersPage());

    expect(screen.getByText("No users found.")).toBeInTheDocument();
    expect(screen.queryByTestId("user-administration")).not.toBeInTheDocument();
  });

  it("redirects unauthorized requests before user or role reads", async () => {
    mocks.assertPermission.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(UsersPage()).rejects.toThrow("REDIRECT:/forbidden");
    expect(mocks.listLocalizedRoles).not.toHaveBeenCalled();
    expect(mocks.listUsersWithRoles).not.toHaveBeenCalled();
  });
});
