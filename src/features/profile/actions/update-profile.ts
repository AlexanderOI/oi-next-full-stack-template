"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db/drizzle";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getFieldErrors } from "@/lib/utils";
import { type ProfileSchemaType, profileSchema } from "@/features/profile/schemas/profile";

export async function updateProfile(data: ProfileSchemaType) {
  let profileUpdated = false;

  try {
    const requestHeaders = await headers();
    const session = await auth.api.getSession({
      headers: requestHeaders,
    });

    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = profileSchema.safeParse(data);

    if (!parsed.success) {
      return { success: false, error: "Validation failed", details: getFieldErrors(parsed.error) };
    }

    const [existingUsername] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.username, parsed.data.username), ne(user.id, session.user.id)))
      .limit(1);

    if (existingUsername) {
      return {
        success: false,
        error: "Username is already taken",
        details: { username: ["Username is already taken"] },
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update profile";
    return {
      success: false,
      profileUpdated,
      error: profileUpdated
        ? `Profile details were updated, but the email verification could not be sent: ${message}`
        : message,
    };
  }
}
