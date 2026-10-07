import { describe, expect, expectTypeOf, it } from "vitest";

import {
  userAccessInputSchema,
  type UserAccessInput,
  type UserAccessResult,
} from "@/features/authorization/contracts";

describe("user access contracts", () => {
  it("accepts only a target user and an explicit desired access status", () => {
    expect(userAccessInputSchema.parse({ userId: "user-1", status: "disabled" })).toEqual({
      userId: "user-1",
      status: "disabled",
    });
    expect(userAccessInputSchema.safeParse({ userId: "", status: "active" }).success).toBe(false);
    expect(userAccessInputSchema.safeParse({ userId: "user-1", status: "pending" }).success).toBe(
      false
    );
    expectTypeOf<UserAccessInput>().toEqualTypeOf<{
      userId: string;
      status: "active" | "disabled";
    }>();
  });

  it("exposes truthful changed and unchanged success outcomes", () => {
    expectTypeOf<UserAccessResult>().toMatchTypeOf<
      | {
          success: true;
          data: { userId: string; status: "active" | "disabled"; changed: boolean };
        }
      | { success: false; code: string }
    >();
  });
});
