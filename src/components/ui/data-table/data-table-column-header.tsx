"use client";

import type { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Props<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
  className?: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: Props<TData, TValue>) {
  if (!column.getCanSort() && !column.getCanHide()) {
    return <span className={className}>{title}</span>;
  }

  const sorting = column.getIsSorted();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="sm" className={cn("-ml-2 font-medium", className)} />}
      >
        {title}
        {sorting === "asc" ? (
          <ArrowUp aria-hidden="true" />
        ) : sorting === "desc" ? (
          <ArrowDown aria-hidden="true" />
        ) : (
          <ChevronsUpDown aria-hidden="true" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {column.getCanSort() && (
          <>
            <DropdownMenuItem onClick={() => column.toggleSorting(false, false)}>
              <ArrowUp aria-hidden="true" />
              Sort ascending
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => column.toggleSorting(true, false)}>
              <ArrowDown aria-hidden="true" />
              Sort descending
            </DropdownMenuItem>
            {sorting && (
              <DropdownMenuItem onClick={() => column.clearSorting()}>
                <X aria-hidden="true" />
                Clear sorting
              </DropdownMenuItem>
            )}
          </>
        )}
        {column.getCanHide() && (
          <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
            <EyeOff aria-hidden="true" />
            Hide column
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
