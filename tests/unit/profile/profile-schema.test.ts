import { describe, expect, it } from "vitest";

import { profileSchema } from "@/features/profile/schemas/profile";

describe("profileSchema", () => {
  it("normalizes whitespace and email casing", () => {
    expect(
      profileSchema.parse({
        name: "  Alex Doe  ",
        username: "  alex.doe  ",
        email: "  ALEX@EXAMPLE.COM  ",
      })
    ).toEqual({
      name: "Alex Doe",
      username: "alex.doe",
      email: "alex@example.com",
    });
  });

  it("rejects usernames outside the Better Auth username convention", () => {
    const result = profileSchema.safeParse({
      name: "Alex Doe",
      username: "Alex_Doe",
      email: "alex@example.com",
    });

    expect(result.success).toBe(false);
  });
});
