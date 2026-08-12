"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";

const avatarSchema = z.url("Invalid image URL");

export async function updateAvatar(image: string) {
  try {
    const parsed = avatarSchema.safeParse(image);

    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid image URL" };
    }

    const requestHeaders = await headers();
    const session = await auth.api.getSession({ headers: requestHeaders });

    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    await auth.api.updateUser({
      headers: requestHeaders,
      body: { image: parsed.data },
    });
    revalidatePath("/profile");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update avatar",
    };
  }
}
