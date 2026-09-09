import {
  type Column,
  type ColumnDef,
  type ReactTable,
  type RowData,
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
} from "@tanstack/react-table";

export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});

export type DataTableColumn<TData extends RowData, TValue = unknown> = Column<
  typeof dataTableFeatures,
  TData,
  TValue
>;

export type DataTableColumnDef<TData extends RowData, TValue = unknown> = ColumnDef<
  typeof dataTableFeatures,
  TData,
  TValue
>;

export type DataTableInstance<TData extends RowData> = ReactTable<typeof dataTableFeatures, TData>;
