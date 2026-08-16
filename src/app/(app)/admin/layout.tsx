import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { assertAnyPermission, PERMISSIONS } from "@/features/authorization/server";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  try {
    await assertAnyPermission([PERMISSIONS.ROLES_READ, PERMISSIONS.USERS_READ]);
  } catch {
    redirect("/forbidden");
  }
  return children;
}
