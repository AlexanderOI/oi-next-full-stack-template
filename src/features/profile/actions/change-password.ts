"use server";

import { headers } from "next/headers";

import { auth } from "@/features/auth/server";
import { passwordChangeSchema, type PasswordChangeInput } from "../contracts";

export async function changePassword(data: PasswordChangeInput) {
  try {
    const parsed = passwordChangeSchema.safeParse(data);

    if (!parsed.success) {
      return { success: false, error: "Validation failed" };
    }

    const requestHeaders = await headers();
    const session = await auth.api.getSession({ headers: requestHeaders });

    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    await auth.api.changePassword({
      headers: requestHeaders,
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: true,
      },
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to change password",
    };
  }
}
