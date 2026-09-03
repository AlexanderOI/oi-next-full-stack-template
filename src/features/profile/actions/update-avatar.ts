"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { auth } from "@/features/auth/server";
import { requireAuthorizedSession, PERMISSIONS } from "@/features/authorization/server";
import { uploadImage } from "@/services/storage/cloudinary/upload-image";
import { avatarSchema } from "../schemas/avatar-schema";

export async function updateAvatar(file: File) {
  try {
    const parsed = avatarSchema.safeParse(file);

    if (!parsed.success) {
      const tooLarge = parsed.error.issues.some((issue) => issue.code === "too_big");
      return {
        success: false,
        code: tooLarge ? ("AVATAR_TOO_LARGE" as const) : ("AVATAR_INVALID_TYPE" as const),
      };
    }

    const requestHeaders = await headers();
    await requireAuthorizedSession(PERMISSIONS.PROFILE_UPDATE_OWN);

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
  } catch {
    return { success: false, code: "AVATAR_UPDATE_FAILED" as const };
  }
}
