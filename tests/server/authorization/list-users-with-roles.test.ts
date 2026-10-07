import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  asc: vi.fn((column) => ({ direction: "asc", column })),
  from: vi.fn(),
  leftJoin: vi.fn(),
  orderBy: vi.fn(),
  select: vi.fn(),
  tables: {
    user: {
      table: "user",
      id: "user.id",
      name: "user.name",
      email: "user.email",
      emailVerified: "user.emailVerified",
      username: "user.username",
      invitedAt: "user.invitedAt",
      disabledAt: "user.disabledAt",
    },
    userRole: {
      table: "user-role",
      userId: "user-role.userId",
      roleId: "user-role.roleId",
    },
  },
}));

vi.mock("drizzle-orm", () => ({
  asc: mocks.asc,
  eq: vi.fn((left, right) => ({ left, right })),
}));
vi.mock("@/db/schema", () => ({ user: mocks.tables.user, userRole: mocks.tables.userRole }));
vi.mock("@/db/drizzle", () => ({ db: { select: mocks.select } }));

import { listUsersWithRoles } from "@/features/authorization/data/list-users-with-roles";

describe("listUsersWithRoles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.select.mockReturnValue({ from: mocks.from });
    mocks.from.mockReturnValue({ leftJoin: mocks.leftJoin });
    mocks.leftJoin.mockReturnValue({ orderBy: mocks.orderBy });
  });

  it("maps lifecycle state, preserves sorted role ids, and orders users deterministically", async () => {
    const invitedAt = new Date("2026-09-28T10:00:00.000Z");
    const disabledAt = new Date("2026-09-28T11:00:00.000Z");
    mocks.orderBy.mockResolvedValue([
      {
        id: "user-1",
        name: "Alex",
        email: "alex@example.com",
        emailVerified: false,
        username: "alex",
        invitedAt,
        disabledAt,
        roleId: "role-z",
      },
      {
        id: "user-1",
        name: "Alex",
        email: "alex@example.com",
        emailVerified: false,
        username: "alex",
        invitedAt,
        disabledAt,
        roleId: "role-a",
      },
    ]);

    await expect(listUsersWithRoles()).resolves.toEqual([
      {
        id: "user-1",
        name: "Alex",
        email: "alex@example.com",
        emailVerified: false,
        username: "alex",
        invitedAt,
        disabledAt,
        roleIds: ["role-a", "role-z"],
      },
    ]);
    expect(mocks.orderBy).toHaveBeenCalledWith(
      { direction: "asc", column: "user.name" },
      { direction: "asc", column: "user.email" },
      { direction: "asc", column: "user.id" }
    );
  });
});
