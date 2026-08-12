import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSidebarCollapsed } from "@/actions/sidebar";
import { DashboardHeader } from "@/features/dashboard/components/header";
import { DashboardSidebar } from "@/features/dashboard/components/sidebar";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/auth/sign-in");
  }

  const sidebarCollapsed = await getSidebarCollapsed();

  return (
    <div className="dark flex h-screen flex-col">
      <DashboardHeader />
      <div className="flex flex-1 overflow-hidden">
        <DashboardSidebar initialCollapsed={sidebarCollapsed} />
        <main className="bg-background flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
