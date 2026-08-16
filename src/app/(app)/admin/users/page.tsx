import { redirect } from "next/navigation";

import { UserRoleAssignment } from "@/features/authorization/client";
import {
  assertPermission,
  listRoles,
  listUsersWithRoles,
  PERMISSIONS,
} from "@/features/authorization/server";

export default async function UsersPage() {
  try {
    await assertPermission(PERMISSIONS.USERS_READ);
  } catch {
    redirect("/forbidden");
  }
  const [roles, users] = await Promise.all([listRoles(), listUsersWithRoles()]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-muted-foreground">Every user must retain at least one role.</p>
      </div>
      {users.map((user) => (
        <UserRoleAssignment key={user.id} user={user} roles={roles} />
      ))}
    </div>
  );
}
