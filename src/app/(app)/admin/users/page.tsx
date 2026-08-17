import { redirect } from "next/navigation";

import { UserRoleAssignment } from "@/features/authorization/client";
import {
  assertPermission,
  listLocalizedRoles,
  listUsersWithRoles,
  PERMISSIONS,
} from "@/features/authorization/server";
import { getTranslations } from "next-intl/server";

export default async function UsersPage() {
  const t = await getTranslations("authorization.users");
  try {
    await assertPermission(PERMISSIONS.USERS_READ);
  } catch {
    redirect("/forbidden");
  }
  const [roles, users] = await Promise.all([listLocalizedRoles(), listUsersWithRoles()]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>
      {users.map((user) => (
        <UserRoleAssignment key={user.id} user={user} roles={roles} />
      ))}
    </div>
  );
}
