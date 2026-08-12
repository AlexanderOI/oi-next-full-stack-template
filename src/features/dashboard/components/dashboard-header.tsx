import { type LucideIcon } from "lucide-react";

interface DashboardHeaderProps {
  title: string;
  breadcrumbIcon?: LucideIcon;
  breadcrumbLabel?: string;
  children?: React.ReactNode;
}

export function DashboardHeader({
  title,
  breadcrumbIcon: BreadcrumbIcon,
  breadcrumbLabel,
  children,
}: DashboardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <div className="flex items-center gap-1.5 text-sm">
          {BreadcrumbIcon && <BreadcrumbIcon className="text-muted-foreground size-3.5" />}
          <span className="text-muted-foreground font-medium">{breadcrumbLabel}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
