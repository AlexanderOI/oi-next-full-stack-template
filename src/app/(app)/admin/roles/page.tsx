import { redirect } from "next/navigation";

import { RoleEditor } from "@/features/authorization/client";
import {
  assertPermission,
  listRoles,
  permissionCatalog,
  permissionKeys,
  PERMISSIONS,
} from "@/features/authorization/server";

export default async function RolesPage() {
  try {
    await assertPermission(PERMISSIONS.ROLES_READ);
  } catch {
    redirect("/forbidden");
  }
  const roles = await listRoles();
  const permissionOptions = permissionKeys.map((key) => ({
    key,
    description: permissionCatalog[key],
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Roles</h1>
        <p className="text-muted-foreground">
          System roles are synchronized by the bootstrap and cannot be edited here.
        </p>
      </div>
      <RoleEditor permissionOptions={permissionOptions} />
      {roles.map((role) => (
        <RoleEditor key={role.id} role={role} permissionOptions={permissionOptions} />
      ))}
    </div>
  );
}
