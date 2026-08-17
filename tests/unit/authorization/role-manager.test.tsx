import { renderInEnglish as render, screen, waitFor, within } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RoleManager } from "@/features/authorization/components/role-manager";
import {
  permissionCatalog,
  PERMISSIONS,
  type RoleSummary,
} from "@/features/authorization/contracts";

const { saveRole } = vi.hoisted(() => ({ saveRole: vi.fn() }));

vi.mock("@/features/authorization/actions/manage-roles", () => ({
  deleteRole: vi.fn(),
  saveRole,
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const roles: readonly RoleSummary[] = [
  {
    id: "system:admin",
    key: "admin",
    name: "Administrator",
    description: "Full application access",
    isSystem: true,
    permissions: [PERMISSIONS.ROLES_READ],
  },
  {
    id: "support-lead",
    key: "support.lead",
    name: "Support Lead",
    description: "Helps customers resolve account issues",
    isSystem: false,
    permissions: [PERMISSIONS.PROFILE_READ_OWN],
  },
];

describe("RoleManager", () => {
  beforeEach(() => {
    saveRole.mockReset();
    saveRole.mockResolvedValue({ success: true, data: { id: "role-new" } });
  });

  it("restores trigger focus after cancel and successful creation", async () => {
    const user = userEvent.setup();
    render(<RoleManager roles={roles} permissionOptions={permissionCatalog} />);

    expect(screen.queryByRole("region", { name: "Create role" })).not.toBeInTheDocument();

    const trigger = screen.getByRole("button", { name: "Create role" });
    await user.click(trigger);

    let createRegion = screen.getByRole("region", { name: "Create role" });
    expect(createRegion).toBeInTheDocument();
    expect(within(createRegion).getByRole("textbox", { name: "Name" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("region", { name: "Create role" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    createRegion = screen.getByRole("region", { name: "Create role" });
    await user.type(within(createRegion).getByRole("textbox", { name: "Name" }), "New role");
    await user.click(within(createRegion).getAllByRole("checkbox")[0]);
    await user.click(within(createRegion).getByRole("button", { name: "Save role" }));

    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "Create role" })).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  it("filters by role name and description and reports an empty result", async () => {
    const user = userEvent.setup();
    render(<RoleManager roles={roles} permissionOptions={permissionCatalog} />);
    const search = screen.getByRole("searchbox", { name: "Search roles" });

    expect(screen.getByText("2 of 2 roles")).toBeInTheDocument();
    await user.type(search, "account issues");
    expect(screen.getByText("Support Lead")).toBeInTheDocument();
    expect(screen.queryByText("Administrator")).not.toBeInTheDocument();
    expect(screen.getByText("1 of 2 roles")).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "missing role");
    expect(screen.getByText("No roles match your search.")).toBeInTheDocument();
    expect(screen.getByText("0 of 2 roles")).toBeInTheDocument();
  });
});
