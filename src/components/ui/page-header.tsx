import { type LucideIcon } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  descriptionIcon?: LucideIcon;
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  descriptionIcon: DescriptionIcon,
  children,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
            {DescriptionIcon && <DescriptionIcon aria-hidden="true" className="size-3.5" />}
            <p>{description}</p>
          </div>
        )}
      </div>
      {children && <div className="flex items-center gap-2 sm:justify-end">{children}</div>}
    </header>
  );
}
