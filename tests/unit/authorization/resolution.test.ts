import { describe, expect, it } from "vitest";

import { PERMISSIONS } from "@/features/authorization/contracts";
import { buildAuthorizationSnapshot } from "@/features/authorization/resolution";

describe("authorization resolution", () => {
  it("deduplicates and sorts effective roles and known permissions", () => {
    expect(
      buildAuthorizationSnapshot("u1", [
        { userId: "u1", roleKey: "member", permissionKey: PERMISSIONS.PROFILE_READ_OWN },
        { userId: "u1", roleKey: "admin", permissionKey: PERMISSIONS.ROLES_READ },
        { userId: "u1", roleKey: "member", permissionKey: PERMISSIONS.PROFILE_READ_OWN },
        { userId: "u1", roleKey: "broken", permissionKey: "unknown.permission" },
        { userId: "other", roleKey: "admin", permissionKey: PERMISSIONS.ROLES_DELETE },
      ])
    ).toEqual({
      userId: "u1",
      roles: ["admin", "broken", "member"],
      permissions: [PERMISSIONS.ROLES_READ, PERMISSIONS.PROFILE_READ_OWN],
    });
  });
});
