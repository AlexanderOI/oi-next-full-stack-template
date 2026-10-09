"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Zap } from "lucide-react";
import { useTranslations } from "next-intl";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/features/auth/client";
import { OrganizationHeaderSelector } from "@/features/organizations/client";

interface Props {
  organizations: { id: string; slug: string; name: string }[];
  activeOrganizationId: string | null;
}

export function AppHeader({ organizations, activeOrganizationId }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const t = useTranslations("shell");
  const active = organizations.find(({ id }) => id === activeOrganizationId);
  const segments = pathname.split("/").filter(Boolean);
  const isOrganizationPage = segments[0] === "org" && segments[1] === active?.slug;
  const label = isOrganizationPage
    ? segments[2] === "members"
      ? t("members")
      : segments[2] === "invitations"
        ? t("invitations")
        : t("dashboard")
    : segments[0] === "profile"
      ? t("profile")
      : segments[0] === "admin" && segments[1] === "roles"
        ? t("roles")
        : segments[0] === "admin" && segments[1] === "users"
          ? t("users")
          : segments[0] === "dashboard"
            ? t("dashboard")
            : t("organizations");

  async function handleSignOut() {
    await signOut();
    router.push("/auth/sign-in");
  }

  return (
    <header className="bg-header border-header-border flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4">
      <div className="flex items-center gap-2">
        <div className="bg-primary flex size-7 items-center justify-center rounded-lg">
          <Zap className="text-primary-foreground size-4" />
        </div>
        <nav aria-label={t("breadcrumb")} className="flex items-center gap-2 text-sm">
          <span className="font-medium">oi-nextjs</span>
          <span aria-hidden="true">/</span>
          <OrganizationHeaderSelector
            organizations={organizations}
            activeOrganizationId={activeOrganizationId}
          />
          <span aria-hidden="true">/</span>
          {active && <Link href={`/org/${active.slug}`}>{t("dashboard")}</Link>}
          {(!active || !isOrganizationPage || segments.length !== 2) && (
            <>
              {active && <span aria-hidden="true">/</span>}
              <span>{label}</span>
            </>
          )}
        </nav>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Avatar size="sm" className="rounded-lg">
            <AvatarFallback className="bg-primary/20 text-primary text-xs">JD</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="bottom" sideOffset={8}>
          <DropdownMenuItem>{t("profile")}</DropdownMenuItem>
          <DropdownMenuItem>{t("settings")}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} variant="destructive">
            {t("signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
