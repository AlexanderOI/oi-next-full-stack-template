import { describe, expect, it } from "vitest";

import { PERMISSIONS } from "@/features/authorization/contracts";
import { evaluatePermissions } from "@/features/authorization/lib/authorization-policy";

describe("platform permission evaluation", () => {
  it("preserves platform grants and rejects organization-scoped requests", () => {
    expect(evaluatePermissions([PERMISSIONS.ROLES_READ], [PERMISSIONS.ROLES_READ], "all")).toBe(
      true
    );
    expect(
      evaluatePermissions([PERMISSIONS.ORGANIZATION_READ], [PERMISSIONS.ORGANIZATION_READ], "all")
    ).toBe(false);
    expect(
      evaluatePermissions(
        [PERMISSIONS.PROFILE_READ_OWN, PERMISSIONS.ORGANIZATION_RESTRICTIONS_CREATE],
        [PERMISSIONS.PROFILE_READ_OWN, PERMISSIONS.ORGANIZATION_RESTRICTIONS_CREATE],
        "all"
      )
    ).toBe(false);
  });
});
