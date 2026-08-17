import { redirect } from "next/navigation";

import { RoleManager } from "@/features/authorization/client";
import {
  assertPermission,
  getLocalizedPermissionCatalog,
  listLocalizedRoles,
  PERMISSIONS,
} from "@/features/authorization/server";

export default async function RolesPage() {
  try {
    await assertPermission(PERMISSIONS.ROLES_READ);
  } catch {
    redirect("/forbidden");
  }
  const [roles, permissionCatalog] = await Promise.all([
    listLocalizedRoles(),
    getLocalizedPermissionCatalog(),
  ]);

  return <RoleManager roles={roles} permissionOptions={permissionCatalog} />;
}
