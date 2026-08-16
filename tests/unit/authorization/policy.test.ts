import { describe, expect, it } from "vitest";

import { PERMISSIONS } from "@/features/authorization/contracts";
import { canReplaceUserRoles, evaluatePermissions } from "@/features/authorization/policy";

describe("permission evaluation", () => {
  const granted = [PERMISSIONS.PROFILE_READ_OWN, PERMISSIONS.ROLES_READ];

  it("supports explicit all and any matching", () => {
    expect(evaluatePermissions(granted, [PERMISSIONS.PROFILE_READ_OWN], "all")).toBe(true);
    expect(
      evaluatePermissions(granted, [PERMISSIONS.ROLES_DELETE, PERMISSIONS.ROLES_READ], "any")
    ).toBe(true);
    expect(
      evaluatePermissions(granted, [PERMISSIONS.PROFILE_READ_OWN, PERMISSIONS.ROLES_DELETE], "all")
    ).toBe(false);
  });

  it("fails closed for empty lists and unknown permissions", () => {
    expect(evaluatePermissions(granted, [], "all")).toBe(false);
    expect(evaluatePermissions(granted, [], "any")).toBe(false);
    expect(evaluatePermissions(granted, ["roles.*"], "any")).toBe(false);
  });
});

describe("administrative assignment policy", () => {
  it("prevents self-lockout", () => {
    expect(
      canReplaceUserRoles({
        actorUserId: "user-1",
        targetUserId: "user-1",
        actorKeepsAdministration: false,
        targetWasAdmin: true,
        targetWillBeAdmin: true,
        adminCount: 2,
      })
    ).toBe(false);
  });

  it("prevents removing the last admin and permits safe changes", () => {
    const base = {
      actorUserId: "actor",
      targetUserId: "target",
      actorKeepsAdministration: true,
      targetWasAdmin: true,
      targetWillBeAdmin: false,
    };
    expect(canReplaceUserRoles({ ...base, adminCount: 1 })).toBe(false);
    expect(canReplaceUserRoles({ ...base, adminCount: 2 })).toBe(true);
  });
});
