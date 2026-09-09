"use client";

import type { RowData } from "@tanstack/react-table";
import { Columns3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DataTableInstance } from "./data-table-features";

interface Props<TData extends RowData> {
  table: DataTableInstance<TData>;
}

export function DataTableViewOptions<TData extends RowData>({ table }: Props<TData>) {
  const columns = table
    .getAllColumns()
    .filter((column) => typeof column.accessorFn !== "undefined" && column.getCanHide());

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <Columns3 aria-hidden="true" />
        Columns
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {columns.map((column) => {
          const header = column.columnDef.header;
          const label = typeof header === "string" ? header : column.id;

          return (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={column.getIsVisible()}
              onCheckedChange={(checked) => column.toggleVisibility(checked)}
            >
              {label}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
