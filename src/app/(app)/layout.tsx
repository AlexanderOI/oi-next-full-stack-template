import { redirect } from "next/navigation";
import { AppHeader, AppSidebar } from "@/features/app-shell/client";
import { getSidebarCollapsed } from "@/features/app-shell/server";
import { requireSession } from "@/features/auth/server";
import { AuthorizationProvider } from "@/features/authorization/client";
import { getAuthorizationSnapshot } from "@/features/authorization/server";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  try {
    await requireSession();
  } catch {
    redirect("/auth/sign-in");
  }
  const snapshot = await getAuthorizationSnapshot();
  if (!snapshot) redirect("/auth/sign-in");

  const sidebarCollapsed = await getSidebarCollapsed();

  return (
    <AuthorizationProvider snapshot={snapshot}>
      <div className="dark flex h-screen flex-col">
        <AppHeader />
        <div className="flex flex-1 overflow-hidden">
          <AppSidebar initialCollapsed={sidebarCollapsed} />
          <main className="bg-background flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </AuthorizationProvider>
  );
}
