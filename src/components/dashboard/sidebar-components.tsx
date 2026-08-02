"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface SidebarItemProps {
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: SidebarItemProps[];
  collapsed?: boolean;
  active?: boolean;
  indent?: boolean;
}

export function SidebarItem({
  label,
  href,
  icon: Icon,
  children,
  collapsed = false,
  active = false,
  indent = false,
}: SidebarItemProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = children && children.length > 0;
  const isActive = active || (href && pathname === href);

  const content = (
    <button
      type="button"
      onClick={() => hasChildren && setIsOpen(!isOpen)}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
        collapsed && "justify-center px-0",
        indent && !collapsed && "pl-8"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1 text-left">{label}</span>
          {hasChildren && (
            <ChevronDown
              className={cn(
                "size-3.5 shrink-0 transition-transform",
                isOpen && "rotate-180"
              )}
            />
          )}
        </>
      )}
    </button>
  );

  if (href && !hasChildren) {
    const linkClasses = cn(
      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
      isActive
        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
        : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
      collapsed && "justify-center px-0",
      indent && !collapsed && "pl-8"
    );

    if (collapsed) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <Link href={href} className={linkClasses}>
                  <Icon className="size-4 shrink-0" />
                </Link>
              }
            />
            <TooltipContent side="right" align="center">
              {label}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <Link href={href} className={linkClasses}>
        <Icon className="size-4 shrink-0" />
        <span>{label}</span>
      </Link>
    );
  }

  if (collapsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => hasChildren && setIsOpen(!isOpen)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                  "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                  "justify-center px-0"
                )}
              >
                <Icon className="size-4 shrink-0" />
              </button>
            }
          />
          <TooltipContent side="right" align="center">
            {label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div>
      {content}
      {hasChildren && isOpen && (
        <div className="mt-1 space-y-1">
          {children.map((child) => (
            <SidebarItem
              key={child.label}
              {...child}
              collapsed={collapsed}
              indent
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SidebarSectionTitleProps {
  title: string;
  collapsed?: boolean;
}

export function SidebarSectionTitle({ title, collapsed = false }: SidebarSectionTitleProps) {
  if (collapsed) return null;

  return (
    <span className="px-2 pt-2 pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
      {title}
    </span>
  );
}

export function SidebarSeparator() {
  return <Separator className="my-3" />;
}
