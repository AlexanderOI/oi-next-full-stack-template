import { describe, expect, it } from "vitest";

import { PERMISSIONS, roleInputSchema } from "@/features/authorization/contracts";

describe("platform role input", () => {
  it("accepts platform permissions and rejects organization or protected permissions", () => {
    const base = { name: "Support", description: "", permissions: [PERMISSIONS.ROLES_READ] };

    expect(roleInputSchema.safeParse(base).success).toBe(true);
    expect(
      roleInputSchema.safeParse({ ...base, permissions: [PERMISSIONS.ORGANIZATION_READ] }).success
    ).toBe(false);
    expect(
      roleInputSchema.safeParse({
        ...base,
        permissions: [PERMISSIONS.ORGANIZATION_RESTRICTIONS_CREATE],
      }).success
    ).toBe(false);
  });
});
