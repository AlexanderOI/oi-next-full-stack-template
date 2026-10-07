"use client";

import { flexRender, type RowData } from "@tanstack/react-table";
import type { ComponentProps, ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { DataTableInstance } from "./data-table-features";
import { defaultDataTableLabels, type DataTableLabels } from "./data-table-labels";
import { DataTablePagination } from "./data-table-pagination";

interface Props<TData extends RowData> extends ComponentProps<"div"> {
  table: DataTableInstance<TData>;
  actions?: ReactNode;
  columnWidths?: Partial<Record<string, number>>;
  emptyMessage?: string;
  labels?: DataTableLabels;
  pageSizeOptions?: number[];
  toolbar?: ReactNode;
}

export function DataTable<TData extends RowData>({
  table,
  actions,
  columnWidths,
  emptyMessage = "No results.",
  labels = defaultDataTableLabels,
  pageSizeOptions,
  toolbar,
  className,
  ...props
}: Props<TData>) {
  const rows = table.getRowModel().rows;
  const visibleColumns = table.getVisibleLeafColumns();
  const visibleColumnCount = Math.max(visibleColumns.length, 1);
  const hasPercentageWidths = visibleColumns.some(
    (column) => columnWidths?.[column.id] !== undefined
  );

  return (
    <div className={cn("flex w-full flex-col gap-3", className)} {...props}>
      {toolbar}
      <div className="overflow-hidden rounded-lg border">
        <Table style={hasPercentageWidths ? { tableLayout: "fixed" } : undefined}>
          {hasPercentageWidths && (
            <colgroup>
              {visibleColumns.map((column) => {
                const percentageWidth = columnWidths?.[column.id];

                return (
                  <col
                    key={column.id}
                    style={
                      percentageWidth === undefined ? undefined : { width: `${percentageWidth}%` }
                    }
                  />
                );
              })}
            </colgroup>
          )}
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={visibleColumnCount} className="h-24 text-center">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-3">
        <DataTablePagination table={table} labels={labels} pageSizeOptions={pageSizeOptions} />
        {actions}
      </div>
    </div>
  );
}
