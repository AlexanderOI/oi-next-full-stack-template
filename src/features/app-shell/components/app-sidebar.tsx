"use client";

import { useState, useTransition } from "react";
import {
  Activity,
  Cloud,
  Code2,
  DatabaseBackup,
  KeyRound,
  LayoutDashboard,
  Lock,
  Monitor,
  PanelLeft,
  PanelLeftClose,
  Settings,
  ShieldCheck,
  Table2,
  User,
} from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { setSidebarCollapsed } from "../actions/sidebar-preference";
import {
  SidebarNavigationItem,
  SidebarSectionTitle,
  SidebarSeparator,
  type SidebarNavigationItemProps,
} from "./sidebar-navigation-item";

const generalNav: SidebarNavigationItemProps[] = [
  { label: "Panel", href: "/dashboard", icon: LayoutDashboard },
  { label: "Profile", href: "/profile", icon: User },
  { label: "Settings", href: "/settings", icon: Settings },
];
const environmentNav: SidebarNavigationItemProps[] = [
  { label: "Overview", href: "/dashboard/overview", icon: Activity },
  { label: "Monitoring", href: "/dashboard/monitoring", icon: Monitor },
  { label: "Editor", href: "/dashboard/editor", icon: Code2 },
  { label: "Tables", href: "/dashboard/tables", icon: Table2 },
  { label: "Backups", href: "/dashboard/backups", icon: DatabaseBackup },
  { label: "Data Masking", href: "/dashboard/masking", icon: ShieldCheck },
];
const backendNav: SidebarNavigationItemProps[] = [
  { label: "Data API", href: "/dashboard/api", icon: Cloud },
  { label: "Authentication", href: "/dashboard/auth", icon: KeyRound },
  { label: "Permissions", href: "/dashboard/permissions", icon: Lock },
];

export function AppSidebar({ initialCollapsed }: { initialCollapsed: boolean }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [, startTransition] = useTransition();

  function handleToggle() {
    const nextCollapsed = !collapsed;
    setCollapsed(nextCollapsed);
    startTransition(() => {
      setSidebarCollapsed(nextCollapsed);
    });
  }

  return (
    <aside
      className={cn(
        "border-border/50 bg-sidebar flex h-full shrink-0 flex-col border-r transition-all duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <ScrollArea className="min-h-0 flex-1">
        <nav className="flex flex-col gap-1 px-2 pb-4">
          <SidebarSectionTitle title="General" collapsed={collapsed} />
          {generalNav.map((item) => (
            <SidebarNavigationItem key={item.label} {...item} collapsed={collapsed} />
          ))}
          <SidebarSeparator />
          <SidebarSectionTitle title="Environment" collapsed={collapsed} />
          {environmentNav.map((item) => (
            <SidebarNavigationItem key={item.label} {...item} collapsed={collapsed} />
          ))}
          <SidebarSeparator />
          <SidebarSectionTitle title="Backend" collapsed={collapsed} />
          {backendNav.map((item) => (
            <SidebarNavigationItem key={item.label} {...item} collapsed={collapsed} />
          ))}
        </nav>
      </ScrollArea>
      <div className="border-border/50 border-t p-2">
        <button
          type="button"
          onClick={handleToggle}
          className={cn(
            "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
            collapsed && "justify-center px-0"
          )}
        >
          {collapsed ? (
            <PanelLeft className="size-4 shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="size-4 shrink-0" />
              <span>Collapse menu</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
