export interface DataTableLabels {
  columns: string;
  rowsPerPage: string;
  goToPage: (page: number) => string;
  sortAscending?: string;
  sortDescending?: string;
  clearSorting?: string;
  hideColumn?: string;
  columnLabels?: Readonly<Record<string, string>>;
}

export const defaultDataTableLabels = {
  columns: "Columns",
  rowsPerPage: "Rows per page",
  goToPage: (page: number) => `Go to page ${page}`,
  sortAscending: "Sort ascending",
  sortDescending: "Sort descending",
  clearSorting: "Clear sorting",
  hideColumn: "Hide column",
  columnLabels: {},
} satisfies DataTableLabels;
