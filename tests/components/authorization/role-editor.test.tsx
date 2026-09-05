import { renderInEnglish as render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RoleEditor } from "@/features/authorization/components/role-editor";
import { PERMISSIONS, type RoleSummary } from "@/features/authorization/contracts";

const { saveRole } = vi.hoisted(() => ({ saveRole: vi.fn() }));

vi.mock("@/features/authorization/actions/manage-roles", () => ({
  deleteRole: vi.fn(),
  saveRole,
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const permissionOptions = [
  {
    name: "Authorization",
    permissions: [
      {
        key: PERMISSIONS.ROLES_READ,
        name: "View roles",
        description: "View roles and their permissions",
      },
    ],
  },
] as const;

const configurableRole: RoleSummary = {
  id: "role-1",
  key: "content.editor",
  name: "Content Editor",
  description: "Edits published content",
  isSystem: false,
  permissions: [PERMISSIONS.ROLES_READ],
};

describe("RoleEditor", () => {
  beforeEach(() => {
    saveRole.mockReset();
    saveRole.mockResolvedValue({ success: true, data: { id: "role-1" } });
  });

  it("allows system-role inspection without editable or destructive controls", async () => {
    const user = userEvent.setup();
    render(
      <RoleEditor
        role={{ ...configurableRole, id: "admin", name: "Administrator", isSystem: true }}
        permissionOptions={permissionOptions}
      />
    );

    expect(screen.getByText("Managed by the system")).toBeInTheDocument();
    await user.click(screen.getByText("Administrator"));

    expect(screen.getByText(/you can inspect its details/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Description" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /save role/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("submits only editable role data and never exposes a key input", async () => {
    const user = userEvent.setup();
    render(<RoleEditor permissionOptions={permissionOptions} />);

    expect(screen.queryByRole("textbox", { name: "Key" })).not.toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Support Lead");
    await user.type(screen.getByRole("textbox", { name: "Description" }), "Leads support");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Save role" }));

    expect(saveRole).toHaveBeenCalledWith({
      id: undefined,
      name: "Support Lead",
      description: "Leads support",
      permissions: [PERMISSIONS.ROLES_READ],
    });
  });

});
