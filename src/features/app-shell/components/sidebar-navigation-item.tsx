"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface SidebarNavigationItemProps {
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: SidebarNavigationItemProps[];
  collapsed?: boolean;
  active?: boolean;
  indent?: boolean;
}

export function SidebarNavigationItem({
  label,
  href,
  icon: Icon,
  children,
  collapsed = false,
  active = false,
  indent = false,
}: SidebarNavigationItemProps) {
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);

  const hasChildren = Boolean(children?.length);
  const isActive = active || (href && pathname === href);
  const classes = cn(
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
    isActive
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
      : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
    collapsed && "justify-center px-0",
    indent && !collapsed && "pl-8"
  );

  function handleToggleChildren() {
    if (hasChildren) setIsOpen((current) => !current);
  }

  if (href && !hasChildren) {
    const link = (
      <Link href={href} className={classes}>
        <Icon className="size-4 shrink-0" />
        {!collapsed && <span>{label}</span>}
      </Link>
    );
    if (!collapsed) return link;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger render={link} />
          <TooltipContent side="right" align="center">
            {label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const button = (
    <button type="button" onClick={handleToggleChildren} className={classes}>
      <Icon className="size-4 shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1 text-left">{label}</span>
          {hasChildren && (
            <ChevronDown
              className={cn("size-3.5 shrink-0 transition-transform", isOpen && "rotate-180")}
            />
          )}
        </>
      )}
    </button>
  );

  if (collapsed)
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger render={button} />
          <TooltipContent side="right" align="center">
            {label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );

  return (
    <div>
      {button}
      {hasChildren && isOpen && (
        <div className="mt-1 space-y-1">
          {children?.map((child) => (
            <SidebarNavigationItem key={child.label} {...child} collapsed={collapsed} indent />
          ))}
        </div>
      )}
    </div>
  );
}

export function SidebarSectionTitle({
  title,
  collapsed = false,
}: {
  title: string;
  collapsed?: boolean;
}) {
  if (collapsed) return null;
  return (
    <span className="text-muted-foreground px-2 pt-2 pb-1 text-[10px] font-semibold tracking-wider uppercase">
      {title}
    </span>
  );
}

export function SidebarSeparator() {
  return <Separator className="my-3" />;
}
