import { act, renderHook, waitFor } from "@testing-library/react";
import { type OnUrlUpdateFunction, withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import type { DataTableColumnDef } from "@/components/ui/data-table/data-table-features";
import { createDataTableParsers } from "@/components/ui/data-table/data-table-search-params";
import { useDataTable } from "@/components/ui/data-table/use-data-table";

interface RecordRow {
  id: string;
  name: string;
  status: string;
}

const columns: DataTableColumnDef<RecordRow>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "status", header: "Status" },
];

const data: RecordRow[] = [
  { id: "bravo", name: "Bravo", status: "open" },
  { id: "alpha", name: "Alpha", status: "closed" },
  { id: "charlie", name: "Charlie", status: "open" },
];

const parsers = createDataTableParsers({ columnIds: ["name", "status"] });

describe("useDataTable", () => {
  it("keeps URL-backed sorting, filtering, and pagination manual by default", async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const wrapper = withNuqsTestingAdapter({
      hasMemory: true,
      onUrlUpdate,
      searchParams: {
        filters: JSON.stringify([{ id: "status", value: "open" }]),
        page: "2",
        perPage: "1",
        sort: JSON.stringify([{ id: "name", desc: false }]),
      },
    });

    const { result } = renderHook(
      () => useDataTable({ columns, data, pageCount: 3, parsers, getRowId: (row) => row.id }),
      { wrapper }
    );

    expect(result.current.state.pagination).toEqual({ pageIndex: 1, pageSize: 1 });
    expect(result.current.state.sorting).toEqual([{ id: "name", desc: false }]);
    expect(result.current.state.columnFilters).toEqual([{ id: "status", value: "open" }]);
    expect(result.current.getRowModel().rows.map((row) => row.id)).toEqual([
      "bravo",
      "alpha",
      "charlie",
    ]);

    act(() => result.current.setPageIndex(2));

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalledOnce());
    expect(onUrlUpdate.mock.calls[0]?.[0].searchParams.get("page")).toBe("3");
  });

  it("enables client row models and keeps selection and visibility local", () => {
    const wrapper = withNuqsTestingAdapter({
      searchParams: {
        filters: JSON.stringify([{ id: "status", value: "open" }]),
        page: "1",
        perPage: "1",
        sort: JSON.stringify([{ id: "name", desc: true }]),
      },
    });

    const { result } = renderHook(
      () =>
        useDataTable({
          columns,
          data,
          enableRowSelection: true,
          getRowId: (row) => row.id,
          manualFiltering: false,
          manualPagination: false,
          manualSorting: false,
          pageCount: 3,
          parsers,
        }),
      { wrapper }
    );

    expect(result.current.getRowModel().rows.map((row) => row.id)).toEqual(["charlie"]);

    act(() => {
      result.current.getRow("charlie").toggleSelected(true);
      result.current.getColumn("status")?.toggleVisibility(false);
    });

    expect(result.current.state.rowSelection).toEqual({ charlie: true });
    expect(result.current.state.columnVisibility).toEqual({ status: false });
    expect(result.current.getVisibleLeafColumns().map((column) => column.id)).toEqual(["name"]);
  });
});
