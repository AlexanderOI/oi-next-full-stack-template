import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  requireSession: vi.fn(),
  dbSelect: vi.fn(),
}));

vi.mock("react", () => ({ cache: (callback: unknown) => callback }));
vi.mock("next-intl/server", () => ({ getTranslations: vi.fn() }));
vi.mock("drizzle-orm", () => ({
  asc: vi.fn(),
  eq: vi.fn((column, value) => ({ column, value })),
  isNull: vi.fn((column) => ({ isNull: column })),
}));
vi.mock("@/features/auth/server", () => ({
  getCurrentSession: mocks.getCurrentSession,
  requireSession: mocks.requireSession,
}));
vi.mock("@/db/drizzle", () => ({ db: { select: mocks.dbSelect } }));
vi.mock("@/db/schema", () => ({
  permission: { key: "permission.key" },
  role: { id: "role.id", key: "role.key" },
  rolePermission: {
    roleId: "rolePermission.roleId",
    permissionKey: "rolePermission.permissionKey",
  },
  user: { id: "user.id", disabledAt: "user.disabledAt" },
  userRole: { userId: "userRole.userId", roleId: "userRole.roleId" },
}));

import { requireAuthorizedSession } from "@/features/authorization/server";
import { PERMISSIONS } from "@/features/authorization/constants/permissions";

describe("authorization context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not authorize a stale actor whose defensive session read was rejected", async () => {
    mocks.requireSession.mockResolvedValue({ user: { id: "disabled-user" } });
    mocks.getCurrentSession.mockResolvedValue(null);

    await expect(requireAuthorizedSession(PERMISSIONS.USER_ACCESS_UPDATE)).rejects.toThrow(
      "FORBIDDEN"
    );
    expect(mocks.dbSelect).not.toHaveBeenCalled();
  });
});
