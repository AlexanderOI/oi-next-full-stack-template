"use client";

import {
  type ColumnVisibilityState,
  type RowData,
  type RowSelectionState,
  type Updater,
  useTable,
} from "@tanstack/react-table";
import { useQueryStates } from "nuqs";
import { useState } from "react";

import type { DataTableParsers } from "./data-table-search-params";
import { dataTableFeatures, type DataTableColumnDef } from "./data-table-features";
import { getFilterQueryUpdate, getPaginationQueryUpdate } from "./data-table-state";

interface UseDataTableOptions<TData extends RowData> {
  columns: DataTableColumnDef<TData>[];
  data: TData[];
  pageCount: number;
  parsers: DataTableParsers;
  enableRowSelection?: boolean;
  getRowId?: (row: TData, index: number) => string;
  initialColumnVisibility?: ColumnVisibilityState;
  manualFiltering?: boolean;
  manualPagination?: boolean;
  manualSorting?: boolean;
}

export function useDataTable<TData extends RowData>({
  columns,
  data,
  pageCount,
  parsers,
  enableRowSelection = false,
  getRowId,
  initialColumnVisibility = {},
  manualFiltering = true,
  manualPagination = true,
  manualSorting = true,
}: UseDataTableOptions<TData>) {
  const [query, setQuery] = useQueryStates(parsers, {
    history: "replace",
    shallow: false,
  });

  const [columnVisibility, setColumnVisibility] = useState(initialColumnVisibility);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const pagination = {
    pageIndex: query.page - 1,
    pageSize: query.perPage,
  };

  function handlePaginationChange(updater: Updater<typeof pagination>) {
    void setQuery(getPaginationQueryUpdate(pagination, updater));
  }

  function handleSortingChange(updater: Updater<typeof query.sort>) {
    const sorting = typeof updater === "function" ? updater(query.sort) : updater;
    void setQuery({ sort: sorting });
  }

  function handleColumnFiltersChange(updater: Updater<typeof query.filters>) {
    void setQuery(getFilterQueryUpdate(query.filters, updater));
  }

  return useTable({
    features: dataTableFeatures,
    columns,
    data,
    pageCount,
    enableRowSelection,
    getRowId,
    manualFiltering,
    manualPagination,
    manualSorting,
    onColumnFiltersChange: handleColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: handlePaginationChange,
    onRowSelectionChange: setRowSelection,
    onSortingChange: handleSortingChange,
    state: {
      columnFilters: query.filters,
      columnVisibility,
      pagination,
      rowSelection,
      sorting: query.sort,
    },
  });
}
