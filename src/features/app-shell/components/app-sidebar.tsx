"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Building2,
  LayoutDashboard,
  Mail,
  PanelLeft,
  PanelLeftClose,
  ShieldCheck,
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
  organizationNavigation: {
    slug: string;
    canReadMembers: boolean;
    canReadInvitations: boolean;
  } | null;
}

export function AppSidebar({ initialCollapsed, organizationNavigation }: Props) {
  const t = useTranslations("shell");

  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [, startTransition] = useTransition();

  const generalNav: SidebarNavigationItemProps[] = [
    { label: t("dashboard"), href: "/dashboard", icon: LayoutDashboard },
    { label: t("profile"), href: "/profile", icon: User },
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
          <SidebarSeparator />
          <SidebarSectionTitle title={t("organizationSection")} collapsed={collapsed} />
          <SidebarNavigationItem
            label={t("organizations")}
            href="/org"
            icon={Building2}
            collapsed={collapsed}
          />
          {organizationNavigation && (
            <>
              <SidebarNavigationItem
                label={t("workspace")}
                href={`/org/${organizationNavigation.slug}`}
                icon={Building2}
                collapsed={collapsed}
              />
              {organizationNavigation.canReadMembers && (
                <SidebarNavigationItem
                  label={t("members")}
                  href={`/org/${organizationNavigation.slug}/members`}
                  icon={Users}
                  collapsed={collapsed}
                />
              )}
              {organizationNavigation.canReadInvitations && (
                <SidebarNavigationItem
                  label={t("invitations")}
                  href={`/org/${organizationNavigation.slug}/invitations`}
                  icon={Mail}
                  collapsed={collapsed}
                />
              )}
            </>
          )}
          <Permission permissions={[PERMISSIONS.ROLES_READ, PERMISSIONS.USERS_READ]} match="any">
            <>
              <SidebarSeparator />
              <SidebarSectionTitle title={t("administration")} collapsed={collapsed} />
              <Permission permissions={PERMISSIONS.ROLES_READ}>
                <SidebarNavigationItem
                  label={t("roles")}
                  href="/admin/roles"
                  icon={ShieldCheck}
                  collapsed={collapsed}
                />
              </Permission>
              <Permission permissions={PERMISSIONS.USERS_READ}>
                <SidebarNavigationItem
                  label={t("users")}
                  href="/admin/users"
                  icon={Users}
                  collapsed={collapsed}
                />
              </Permission>
            </>
          </Permission>
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
