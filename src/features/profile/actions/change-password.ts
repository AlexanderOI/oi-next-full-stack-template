"use server";

import { headers } from "next/headers";

import { auth } from "@/features/auth/server";
import { requireAuthorizedSession, PERMISSIONS } from "@/features/authorization/server";
import { createPasswordChangeSchema, type PasswordChangeInput } from "../contracts";

const passwordChangeSchema = createPasswordChangeSchema((key) => key);

export async function changePassword(data: PasswordChangeInput) {
  try {
    const parsed = passwordChangeSchema.safeParse(data);

    if (!parsed.success) {
      return { success: false, code: "VALIDATION_ERROR" as const };
    }

    const requestHeaders = await headers();
    await requireAuthorizedSession(PERMISSIONS.PROFILE_UPDATE_OWN);

    await auth.api.changePassword({
      headers: requestHeaders,
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: true,
      },
    });

    return { success: true };
  } catch {
    return { success: false, code: "PASSWORD_CHANGE_FAILED" as const };
  }
}
