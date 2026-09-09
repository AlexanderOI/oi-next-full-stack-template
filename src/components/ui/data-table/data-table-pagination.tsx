"use client";

import type { Table } from "@tanstack/react-table";
import type { MouseEvent } from "react";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPaginationRange } from "./pagination-range";

interface Props<TData> {
  table: Table<TData>;
  pageSizeOptions?: number[];
}

export function DataTablePagination<TData>({
  table,
  pageSizeOptions = [10, 20, 30, 50],
}: Props<TData>) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();
  const currentPage = pageIndex + 1;
  const pages = getPaginationRange(currentPage, pageCount);

  function handleNavigation(event: MouseEvent<HTMLAnchorElement>, page: number) {
    event.preventDefault();
    table.setPageIndex(page - 1);
  }

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Rows per page</span>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => value && table.setPageSize(Number(value))}
        >
          <SelectTrigger aria-label="Rows per page" className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent side="top">
            {pageSizeOptions.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              aria-disabled={!table.getCanPreviousPage()}
              tabIndex={table.getCanPreviousPage() ? undefined : -1}
              className={!table.getCanPreviousPage() ? "pointer-events-none opacity-50" : undefined}
              onClick={(event) => handleNavigation(event, currentPage - 1)}
            />
          </PaginationItem>
          {pages.map((item, index) => (
            <PaginationItem key={`${item}-${index}`}>
              {item === "ellipsis" ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink
                  href="#"
                  isActive={item === currentPage}
                  aria-label={`Go to page ${item}`}
                  onClick={(event) => handleNavigation(event, item)}
                >
                  {item}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext
              href="#"
              aria-disabled={!table.getCanNextPage()}
              tabIndex={table.getCanNextPage() ? undefined : -1}
              className={!table.getCanNextPage() ? "pointer-events-none opacity-50" : undefined}
              onClick={(event) => handleNavigation(event, currentPage + 1)}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
