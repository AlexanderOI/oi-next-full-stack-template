import { describe, expect, it } from "vitest";

import { createDataTableParsers } from "@/components/ui/data-table/data-table-search-params";
import {
  getFilterQueryUpdate,
  getPaginationQueryUpdate,
} from "@/components/ui/data-table/data-table-state";
import { getPaginationRange } from "@/components/ui/data-table/pagination-range";

describe("data table URL state", () => {
  const parsers = createDataTableParsers({
    columnIds: ["title", "status"],
    defaultPageSize: 20,
  });

  it("accepts valid table state and rejects unknown or malformed columns", () => {
    expect(parsers.sort.parse('[{"id":"title","desc":true}]')).toEqual([
      { id: "title", desc: true },
    ]);
    expect(parsers.filters.parse('[{"id":"status","value":["open","closed"]}]')).toEqual([
      { id: "status", value: ["open", "closed"] },
    ]);
    expect(parsers.sort.parse('[{"id":"owner","desc":false}]')).toBeNull();
    expect(parsers.filters.parse("not-json")).toBeNull();
  });

  it("uses positive one-based pagination values", () => {
    expect(parsers.page.parse("3")).toBe(3);
    expect(parsers.page.parse("0")).toBeNull();
    expect(parsers.perPage.parse("-10")).toBeNull();
  });

  it("keeps URL pages one-based and resets them when page size or filters change", () => {
    expect(
      getPaginationQueryUpdate({ pageIndex: 2, pageSize: 20 }, { pageIndex: 3, pageSize: 20 })
    ).toEqual({ page: 4, perPage: 20 });
    expect(
      getPaginationQueryUpdate({ pageIndex: 2, pageSize: 20 }, { pageIndex: 2, pageSize: 50 })
    ).toEqual({ page: 1, perPage: 50 });
    expect(
      getFilterQueryUpdate([{ id: "status", value: "open" }], [{ id: "status", value: "closed" }])
    ).toEqual({
      filters: [{ id: "status", value: "closed" }],
      page: 1,
    });
  });
});

describe("data table pagination range", () => {
  it("keeps boundary pages and inserts gaps around the current page", () => {
    expect(getPaginationRange(1, 1)).toEqual([1]);
    expect(getPaginationRange(1, 10)).toEqual([1, 2, "ellipsis", 10]);
    expect(getPaginationRange(5, 10)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 10]);
    expect(getPaginationRange(10, 10)).toEqual([1, "ellipsis", 9, 10]);
  });

  it("clamps out-of-range current pages", () => {
    expect(getPaginationRange(99, 3)).toEqual([1, 2, 3]);
    expect(getPaginationRange(1, 0)).toEqual([]);
  });
});
