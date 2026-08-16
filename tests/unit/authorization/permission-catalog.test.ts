import { describe, expect, it } from "vitest";

import { permissionCatalog, permissionKeys, PERMISSIONS } from "@/features/authorization/contracts";

describe("permissionCatalog", () => {
  it("defines ordered sections and complete human-readable metadata", () => {
    expect(permissionCatalog.map(({ name }) => name)).toEqual(["Profile", "Authorization"]);
    expect(permissionCatalog[0].permissions.map(({ key }) => key)).toEqual([
      PERMISSIONS.PROFILE_READ_OWN,
      PERMISSIONS.PROFILE_UPDATE_OWN,
    ]);

    const definitions = permissionCatalog.flatMap(({ permissions }) => permissions);
    expect(definitions.map(({ key }) => key)).toEqual(permissionKeys);
    expect(new Set(definitions.map(({ key }) => key)).size).toBe(permissionKeys.length);
    expect(
      definitions.every(({ name, description }) => name.length > 0 && description.length > 0)
    ).toBe(true);
  });
});
