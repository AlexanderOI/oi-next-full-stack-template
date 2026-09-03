"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db/drizzle";
import { user } from "@/db/schema";
import { auth } from "@/features/auth/server";
import { requireAuthorizedSession, PERMISSIONS } from "@/features/authorization/server";
import { getFieldErrors } from "@/lib/utils";
import { createProfileSchema, type ProfileInput } from "../schemas/profile-schema";

const profileSchema = createProfileSchema((key) => key);

export async function updateProfile(data: ProfileInput) {
  let profileUpdated = false;

  try {
    const requestHeaders = await headers();
    const session = await requireAuthorizedSession(PERMISSIONS.PROFILE_UPDATE_OWN);

    const parsed = profileSchema.safeParse(data);

    if (!parsed.success) {
      return {
        success: false,
        code: "VALIDATION_ERROR" as const,
        details: getFieldErrors(parsed.error),
      };
    }

    const [existingUsername] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.username, parsed.data.username), ne(user.id, session.user.id)))
      .limit(1);

    if (existingUsername) {
      return {
        success: false,
        code: "USERNAME_TAKEN" as const,
        details: { username: ["usernameTaken"] },
      };
    }

    const profileChanged =
      parsed.data.name !== session.user.name || parsed.data.username !== session.user.username;

    const result = profileChanged
      ? await auth.api.updateUser({
          headers: requestHeaders,
          body: {
            name: parsed.data.name,
            username: parsed.data.username,
          },
        })
      : session.user;

    profileUpdated = profileChanged;

    const emailChanged = parsed.data.email !== session.user.email.trim().toLowerCase();

    if (emailChanged) {
      await auth.api.changeEmail({
        headers: requestHeaders,
        body: {
          newEmail: parsed.data.email,
          callbackURL: "/profile",
        },
      });
    }

    revalidatePath("/profile");

    return { success: true, user: result, emailVerificationSent: emailChanged };
  } catch {
    return {
      success: false,
      profileUpdated,
      code: profileUpdated ? ("EMAIL_VERIFICATION_FAILED" as const) : ("UPDATE_FAILED" as const),
    };
  }
}
