"use server";

import { cookies } from "next/headers";

const SIDEBAR_COOKIE_NAME = "sidebar-collapsed";

export async function setSidebarCollapsed(collapsed: boolean) {
  const cookieStore = await cookies();
  cookieStore.set(SIDEBAR_COOKIE_NAME, String(collapsed), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
  });
}

export async function getSidebarCollapsed(): Promise<boolean> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value;
  return value === "true";
}
