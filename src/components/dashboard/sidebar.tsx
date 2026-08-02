"use client";

import { useState } from "react";
import {
  Plug,
  LayoutDashboard,
  Settings,
  Activity,
  Monitor,
  Code2,
  Table2,
  DatabaseBackup,
  ShieldCheck,
  Cloud,
  KeyRound,
  Lock,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { SidebarItem, SidebarSectionTitle, SidebarSeparator } from "./sidebar-components";

interface NavItem {
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavItem[];
}

const generalNav: NavItem[] = [
  { label: "Panel", href: "/dashboard", icon: LayoutDashboard },
  { label: "Settings", href: "/settings", icon: Settings },
];

const environmentNav: NavItem[] = [
  { label: "Overview", href: "/dashboard/overview", icon: Activity },
  { label: "Monitoring", href: "/dashboard/monitoring", icon: Monitor },
  { label: "Editor", href: "/dashboard/editor", icon: Code2 },
  { label: "Tables", href: "/dashboard/tables", icon: Table2 },
  { label: "Backups", href: "/dashboard/backups", icon: DatabaseBackup },
  { label: "Data Masking", href: "/dashboard/masking", icon: ShieldCheck },
];

const backendNav: NavItem[] = [
  { label: "Data API", href: "/dashboard/api", icon: Cloud },
  { label: "Authentication", href: "/dashboard/auth", icon: KeyRound },
  { label: "Permissions", href: "/dashboard/permissions", icon: Lock },
];

interface DashboardSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function DashboardSidebar({ collapsed, onToggle }: DashboardSidebarProps) {
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
            <SidebarItem key={item.label} {...item} collapsed={collapsed} />
          ))}

          <SidebarSeparator />

          <SidebarSectionTitle title="Environment" collapsed={collapsed} />

          {environmentNav.map((item) => (
            <SidebarItem key={item.label} {...item} collapsed={collapsed} />
          ))}

          <SidebarSeparator />

          <SidebarSectionTitle title="Backend" collapsed={collapsed} />
          {backendNav.map((item) => (
            <SidebarItem key={item.label} {...item} collapsed={collapsed} />
          ))}
        </nav>
      </ScrollArea>

      <div className="border-border/50 border-t p-2">
        <button
          type="button"
          onClick={onToggle}
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
