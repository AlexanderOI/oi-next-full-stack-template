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
import { defaultDataTableLabels, type DataTableLabels } from "./data-table-labels";

interface Props<TData extends RowData> {
  table: DataTableInstance<TData>;
  labels?: DataTableLabels;
}

export function DataTableViewOptions<TData extends RowData>({
  table,
  labels = defaultDataTableLabels,
}: Props<TData>) {
  const columns = table
    .getAllColumns()
    .filter((column) => typeof column.accessorFn !== "undefined" && column.getCanHide());

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <Columns3 aria-hidden="true" />
        {labels.columns}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {columns.map((column) => {
          const header = column.columnDef.header;
          const label =
            labels.columnLabels?.[column.id] ??
            (typeof header === "string" ? header : column.id);

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
