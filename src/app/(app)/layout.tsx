import { redirect } from "next/navigation";
import { AppHeader, AppSidebar } from "@/features/app-shell/client";
import { getSidebarCollapsed } from "@/features/app-shell/server";
import { requireSession } from "@/features/auth/server";
import { AuthorizationProvider } from "@/features/authorization/client";
import { getAuthorizationSnapshot } from "@/features/authorization/server";
import {
  getActiveOrganizations,
  getOrganizationMemberPermissions,
  getOrganizationInvitationPermissions,
} from "@/features/organizations/server";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession().catch(() => redirect("/auth/sign-in"));
  const snapshot = await getAuthorizationSnapshot();
  if (!snapshot) redirect("/auth/sign-in");

  const sidebarCollapsed = await getSidebarCollapsed();
  const organizations = await getActiveOrganizations(session.user.id);
  const active = organizations.find(
    (organization) => organization.id === session.session.activeOrganizationId
  );
  const organizationNavigation = active
    ? await (async () => {
        const [members, invitations] = await Promise.all([
          getOrganizationMemberPermissions(session.user.id, active.id),
          getOrganizationInvitationPermissions(session.user.id, active.id),
        ]);
        return {
          slug: active.slug,
          canReadMembers: members.canRead,
          canReadInvitations: invitations.canRead,
        };
      })()
    : null;

  return (
    <AuthorizationProvider snapshot={snapshot}>
      <div className="dark flex h-screen flex-col">
        <AppHeader
          organizations={organizations.map(({ id, slug, name }) => ({ id, slug, name }))}
          activeOrganizationId={active?.id ?? null}
        />
        <div className="flex flex-1 overflow-hidden">
          <AppSidebar
            initialCollapsed={sidebarCollapsed}
            organizationNavigation={organizationNavigation}
          />
          <main className="bg-background flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </AuthorizationProvider>
  );
}
