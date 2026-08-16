import { redirect } from "next/navigation";

import { RoleManager } from "@/features/authorization/client";
import {
  assertPermission,
  listRoles,
  permissionCatalog,
  PERMISSIONS,
} from "@/features/authorization/server";

export default async function RolesPage() {
  try {
    await assertPermission(PERMISSIONS.ROLES_READ);
  } catch {
    redirect("/forbidden");
  }
  const roles = await listRoles();

  return <RoleManager roles={roles} permissionOptions={permissionCatalog} />;
}
