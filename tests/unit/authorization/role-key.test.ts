import { describe, expect, it } from "vitest";

import { PERMISSIONS, roleInputSchema } from "@/features/authorization/contracts";
import { deriveRoleKey, ROLE_KEY_EMPTY_ERROR } from "@/features/authorization/role-key";

describe("deriveRoleKey", () => {
  it.each([
    ["  Content   Editors  ", "content.editors"],
    ["Crème Brûlée Managers", "creme.brulee.managers"],
    ["Straße & Łódź", "strasse.lodz"],
    ["Billing & Support / Tier 2", "billing.support.tier.2"],
  ])("derives a normalized dotted key from %s", (name, expected) => {
    expect(deriveRoleKey(name)).toBe(expected);
  });

  it("trims a long key to the existing 50-character limit without a boundary dot", () => {
    const key = deriveRoleKey(`${"a".repeat(49)} extra`);

    expect(key).toHaveLength(49);
    expect(key).not.toMatch(/\.$/);
    expect(deriveRoleKey("a".repeat(60))).toHaveLength(50);
  });

  it("rejects names that contain no supported letters or numbers", () => {
    expect(() => deriveRoleKey(" --- ")).toThrow(ROLE_KEY_EMPTY_ERROR);
  });

  it("does not accept a client-supplied role key", () => {
    const parsed = roleInputSchema.parse({
      key: "client.controlled",
      name: "Support Lead",
      description: "",
      permissions: [PERMISSIONS.ROLES_READ],
    });

    expect(parsed).not.toHaveProperty("key");
  });
});
