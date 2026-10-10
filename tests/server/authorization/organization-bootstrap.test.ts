import { beforeEach, expect, it, vi } from "vitest";

type RecordedValue = { id?: string; roleId?: string; permissionKey?: string };
const mocks = vi.hoisted(() => ({
  values: [] as { table: string; value: RecordedValue | RecordedValue[] }[],
}));
vi.mock("../../../src/db/drizzle", () => ({
  db: {
    transaction: async (run: (tx: unknown) => Promise<unknown>) =>
      run({
        insert: (table: string) => ({
          values: (value: unknown) => {
            mocks.values.push({ table, value: value as RecordedValue | RecordedValue[] });
            return {
              onConflictDoUpdate: async () => undefined,
              onConflictDoNothing: async () => undefined,
            };
          },
        }),
        delete: () => ({ where: async () => undefined }),
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [{ id: "system:member" }],
              then: (resolve: (value: unknown[]) => unknown) => resolve([]),
            }),
          }),
        }),
      }),
  },
  dbPool: { end: vi.fn() },
}));
vi.mock("../../../src/db/schema", () => ({
  permission: "permission",
  role: "role",
  rolePermission: "rolePermission",
  platformRoleAssignment: "platformRoleAssignment",
  user: "user",
}));
vi.mock("drizzle-orm", () => ({ and: vi.fn(), eq: vi.fn(), notExists: vi.fn() }));

import { bootstrapAuthorization } from "../../../scripts/bootstrap-authorization";
import {
  permissionCatalog,
  platformPermissionKeys,
  PERMISSIONS,
} from "@/features/authorization/contracts";

beforeEach(() => {
  mocks.values = [];
});
it("synchronizes full organization Admin grants while preserving legacy Owner and platform definitions", async () => {
  await bootstrapAuthorization();
  const links = (id: string) =>
    mocks.values
      .filter(({ table }) => table === "rolePermission")
      .flatMap(({ value }) => value)
      .filter((link) => link.roleId === id)
      .map((link) => link.permissionKey)
      .sort();
  const organizationKeys = permissionCatalog
    .flatMap(({ permissions }) => permissions)
    .filter(({ scope }) => scope === "organization")
    .map(({ key }) => key)
    .sort();
  expect(links("system:organization:admin")).toEqual(organizationKeys);
  expect(links("system:organization:owner")).toEqual(organizationKeys);
  expect(links("system:admin")).toEqual([...platformPermissionKeys].sort());
  expect(links("system:member")).toEqual(
    [PERMISSIONS.PROFILE_READ_OWN, PERMISSIONS.PROFILE_UPDATE_OWN].sort()
  );
  expect(
    mocks.values
      .filter(({ table }) => table === "role")
      .flatMap(({ value }) => value)
      .map((value) => value.id)
  ).toContain("system:organization:owner");
});
