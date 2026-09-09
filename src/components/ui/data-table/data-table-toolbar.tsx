"use client";

import type { Table } from "@tanstack/react-table";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";
import { DataTableViewOptions } from "./data-table-view-options";

interface Props<TData> extends ComponentProps<"div"> {
  table: Table<TData>;
}

export function DataTableToolbar<TData>({ table, children, className, ...props }: Props<TData>) {
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
