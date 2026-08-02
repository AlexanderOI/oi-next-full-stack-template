"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardHeader } from "@/components/dashboard/header";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import type { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  if (isPending) {
    return (
      <div className="dark flex h-screen flex-col">
        <div className="flex h-14 items-center border-b px-4">
          <Skeleton className="h-7 w-32" />
        </div>
        <div className="flex flex-1 overflow-hidden">
          <aside className="w-60 border-r p-4">
            <Skeleton className="mb-4 h-8 w-full" />
            <Skeleton className="mb-2 h-6 w-full" />
            <Skeleton className="mb-2 h-6 w-3/4" />
            <Skeleton className="mb-2 h-6 w-5/6" />
          </aside>
          <main className="flex-1 p-6">
            <Skeleton className="mb-4 h-8 w-48" />
            <Skeleton className="h-64 w-full" />
          </main>
        </div>
      </div>
    );
  }

  if (!session) {
    router.push("/auth/sign-in");
  }

  return (
    <div className="dark flex h-screen flex-col">
      <DashboardHeader />
      <div className="flex flex-1 overflow-hidden">
        <DashboardSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((prev) => !prev)}
        />
        <main className="bg-background flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
