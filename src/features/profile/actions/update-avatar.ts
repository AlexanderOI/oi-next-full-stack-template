"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/features/auth/server";
import { uploadImage } from "@/services/storage/cloudinary/upload-image";

const avatarSchema = z
  .file()
  .max(5 * 1024 * 1024, "Image must be smaller than 5MB")
  .mime(
    ["image/jpeg", "image/png", "image/webp", "image/avif"],
    "Please select a supported image file"
  );

export async function updateAvatar(file: File) {
  try {
    const parsed = avatarSchema.safeParse(file);

    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid image URL" };
    }

    const requestHeaders = await headers();
    const session = await auth.api.getSession({ headers: requestHeaders });

    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    const { secureUrl } = await uploadImage(parsed.data, {
      folder: "my-app/avatars",
      width: 256,
      height: 256,
      fit: "cover",
      format: "auto",
      quality: "auto",
      maxFileSize: 5 * 1024 * 1024,
    });

    await auth.api.updateUser({
      headers: requestHeaders,
      body: { image: secureUrl },
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
