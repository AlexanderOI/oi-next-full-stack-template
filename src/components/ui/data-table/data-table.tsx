"use client";

import { flexRender, type Table as TanStackTable } from "@tanstack/react-table";
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
import { DataTablePagination } from "./data-table-pagination";

interface Props<TData> extends ComponentProps<"div"> {
  table: TanStackTable<TData>;
  actions?: ReactNode;
  emptyMessage?: string;
  pageSizeOptions?: number[];
  toolbar?: ReactNode;
}

export function DataTable<TData>({
  table,
  actions,
  emptyMessage = "No results.",
  pageSizeOptions,
  toolbar,
  className,
  ...props
}: Props<TData>) {
  const rows = table.getRowModel().rows;
  const visibleColumnCount = Math.max(table.getVisibleLeafColumns().length, 1);

  return (
    <div className={cn("flex w-full flex-col gap-3", className)} {...props}>
      {toolbar}
      <div className="overflow-hidden rounded-lg border">
        <Table>
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
        <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />
        {actions}
      </div>
    </div>
  );
}
