"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  passwordFormSchema,
  type PasswordFormType,
} from "@/features/profile/schemas/password-form";

export async function changePassword(data: PasswordFormType) {
  try {
    const parsed = passwordFormSchema.safeParse(data);

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
