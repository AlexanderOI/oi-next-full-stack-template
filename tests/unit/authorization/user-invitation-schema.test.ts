import { describe, expect, it } from "vitest";

import { userInvitationSchema } from "@/features/authorization/contracts";

describe("userInvitationSchema", () => {
  it("normalizes invitation identity fields and accepts a supported locale", () => {
    expect(
      userInvitationSchema.parse({
        name: "  Alex   Smith  ",
        email: "  ALEX@Example.COM ",
        username: "  Alex.Smith  ",
        locale: "es",
      })
    ).toEqual({
      name: "Alex Smith",
      email: "alex@example.com",
      username: "alex.smith",
      locale: "es",
    });
  });

  it.each([
    [{ name: "A", email: "alex@example.com", username: "alex", locale: "en" }, "name"],
    [{ name: "Alex", email: "invalid", username: "alex", locale: "en" }, "email"],
    [{ name: "Alex", email: "alex@example.com", username: "A_", locale: "en" }, "username"],
    [{ name: "Alex", email: "alex@example.com", username: "alex", locale: "fr" }, "locale"],
  ])("rejects invalid invitation input", (input, field) => {
    const result = userInvitationSchema.safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
    }
  });
});
