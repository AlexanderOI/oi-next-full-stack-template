"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
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
  Users,
} from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Permission, PERMISSIONS } from "@/features/authorization/client";
import { setSidebarCollapsed } from "../actions/sidebar-preference";
import {
  SidebarNavigationItem,
  SidebarSectionTitle,
  SidebarSeparator,
  type SidebarNavigationItemProps,
} from "./sidebar-navigation-item";

interface Props {
  initialCollapsed: boolean;
}

export function AppSidebar({ initialCollapsed }: Props) {
  const t = useTranslations("shell");

  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [, startTransition] = useTransition();

  const generalNav: SidebarNavigationItemProps[] = [
    { label: t("dashboard"), href: "/dashboard", icon: LayoutDashboard },
    { label: t("profile"), href: "/profile", icon: User },
    { label: t("settings"), href: "/settings", icon: Settings },
  ];
  const environmentNav: SidebarNavigationItemProps[] = [
    { label: t("overview"), href: "/dashboard/overview", icon: Activity },
    { label: t("monitoring"), href: "/dashboard/monitoring", icon: Monitor },
    { label: t("editor"), href: "/dashboard/editor", icon: Code2 },
    { label: t("tables"), href: "/dashboard/tables", icon: Table2 },
    { label: t("backups"), href: "/dashboard/backups", icon: DatabaseBackup },
    { label: t("dataMasking"), href: "/dashboard/masking", icon: ShieldCheck },
  ];
  const backendNav: SidebarNavigationItemProps[] = [
    { label: t("dataApi"), href: "/dashboard/api", icon: Cloud },
    { label: t("authentication"), href: "/dashboard/auth", icon: KeyRound },
    { label: t("permissions"), href: "/dashboard/permissions", icon: Lock },
  ];

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
          <SidebarSectionTitle title={t("general")} collapsed={collapsed} />
          {generalNav.map((item) => (
            <SidebarNavigationItem key={item.label} {...item} collapsed={collapsed} />
          ))}
          <Permission permissions={[PERMISSIONS.ROLES_READ, PERMISSIONS.USERS_READ]} match="any">
            <SidebarNavigationItem
              label={t("administration")}
              href="/admin"
              icon={Users}
              collapsed={collapsed}
            />
          </Permission>
          <SidebarSeparator />
          <SidebarSectionTitle title={t("environment")} collapsed={collapsed} />
          {environmentNav.map((item) => (
            <SidebarNavigationItem key={item.label} {...item} collapsed={collapsed} />
          ))}
          <SidebarSeparator />
          <SidebarSectionTitle title={t("backend")} collapsed={collapsed} />
          {backendNav.map((item) => (
            <SidebarNavigationItem key={item.label} {...item} collapsed={collapsed} />
          ))}
        </nav>
      </ScrollArea>
      <div className="border-border/50 border-t p-2">
        <button
          type="button"
          onClick={handleToggle}
          aria-label={collapsed ? t("expandMenu") : t("collapseMenu")}
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
              <span>{t("collapseMenu")}</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
