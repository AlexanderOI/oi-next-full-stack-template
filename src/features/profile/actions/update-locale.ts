"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

import { env } from "@/config/env";
import { db } from "@/db/drizzle";
import { user } from "@/db/schema";
import { requireSession } from "@/features/auth/server";
import { getLocaleCookieOptions, isLocale, localeCookieName, type Locale } from "@/i18n/config";

export type UpdateLocaleResult =
  | { success: true; locale: Locale }
  | { success: false; code: "INVALID_LOCALE" | "UNAUTHORIZED" | "UPDATE_FAILED" };

export async function updateLocale(locale: string): Promise<UpdateLocaleResult> {
  if (!isLocale(locale)) return { success: false, code: "INVALID_LOCALE" };

  let session;
  try {
    session = await requireSession();
  } catch {
    return { success: false, code: "UNAUTHORIZED" };
  }

  try {
    await db
      .update(user)
      .set({ locale, updatedAt: new Date() })
      .where(eq(user.id, session.user.id));

    const cookieStore = await cookies();
    cookieStore.set(
      localeCookieName,
      locale,
      getLocaleCookieOptions(env.NODE_ENV === "production")
    );

    revalidatePath("/", "layout");
    return { success: true, locale };
  } catch {
    return { success: false, code: "UPDATE_FAILED" };
  }
}
