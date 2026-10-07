import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/ui/page-header";
import { UserAdministration, UserInvitationDialog } from "@/features/authorization/client";
import type { UserAdministrationPermissions } from "@/features/authorization/contracts";
import {
  assertPermission,
  getAuthorizationSnapshot,
  listLocalizedRoles,
  listUsersWithRoles,
  PERMISSIONS,
} from "@/features/authorization/server";

export default async function UsersPage() {
  const t = await getTranslations("authorization.users");
  try {
    await assertPermission(PERMISSIONS.USERS_READ);
  } catch {
    redirect("/forbidden");
  }
  const [roles, users, snapshot] = await Promise.all([
    listLocalizedRoles(),
    listUsersWithRoles(),
    getAuthorizationSnapshot(),
  ]);
  const permissions: UserAdministrationPermissions = {
    canInviteUsers: snapshot?.permissions.includes(PERMISSIONS.USERS_INVITE) ?? false,
    canManageRoles: snapshot?.permissions.includes(PERMISSIONS.USER_ROLES_UPDATE) ?? false,
    canManageAccess: snapshot?.permissions.includes(PERMISSIONS.USER_ACCESS_UPDATE) ?? false,
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        <UserInvitationDialog canInviteUsers={permissions.canInviteUsers} />
      </PageHeader>
      {users.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center">
          {t("empty")}
        </p>
      ) : (
        <UserAdministration
          actorUserId={snapshot?.userId ?? ""}
          users={users}
          roles={roles}
          permissions={permissions}
        />
      )}
    </div>
  );
}
