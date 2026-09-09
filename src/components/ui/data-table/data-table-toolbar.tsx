"use client";

import type { RowData } from "@tanstack/react-table";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";
import type { DataTableInstance } from "./data-table-features";
import { DataTableViewOptions } from "./data-table-view-options";

interface Props<TData extends RowData> extends ComponentProps<"div"> {
  table: DataTableInstance<TData>;
}

export function DataTableToolbar<TData extends RowData>({
  table,
  children,
  className,
  ...props
}: Props<TData>) {
  return (
    <div
      role="toolbar"
      aria-orientation="horizontal"
      className={cn("flex flex-wrap items-center justify-between gap-2", className)}
      {...props}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
      <DataTableViewOptions table={table} />
    </div>
  );
}
