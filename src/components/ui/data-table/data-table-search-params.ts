import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import { createParser } from "nuqs/server";
import { z } from "zod";

const sortingStateSchema = z.array(
  z.object({
    id: z.string().min(1),
    desc: z.boolean(),
  })
);

const filterValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number(), z.boolean()])),
]);

const columnFiltersStateSchema = z.array(
  z.object({
    id: z.string().min(1),
    value: filterValueSchema,
  })
);

const positiveIntegerParser = createParser({
  parse(value) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  },
  serialize(value) {
    return String(value);
  },
});

interface DataTableParserOptions {
  columnIds?: Iterable<string>;
  defaultPageSize?: number;
  defaultSorting?: SortingState;
}

function hasOnlyKnownColumns(
  values: ReadonlyArray<{ id: string }>,
  columnIds?: ReadonlySet<string>
) {
  return !columnIds || values.every((value) => columnIds.has(value.id));
}

export function createDataTableParsers({
  columnIds,
  defaultPageSize = 10,
  defaultSorting = [],
}: DataTableParserOptions = {}) {
  const knownColumnIds = columnIds ? new Set(columnIds) : undefined;

  const sortingParser = createParser<SortingState>({
    parse(value) {
      try {
        const result = sortingStateSchema.safeParse(JSON.parse(value));
        return result.success && hasOnlyKnownColumns(result.data, knownColumnIds)
          ? result.data
          : null;
      } catch {
        return null;
      }
    },
    serialize(value) {
      return JSON.stringify(value);
    },
    eq(a, b) {
      return (
        a.length === b.length &&
        a.every((value, index) => value.id === b[index]?.id && value.desc === b[index]?.desc)
      );
    },
  });

  const filtersParser = createParser<ColumnFiltersState>({
    parse(value) {
      try {
        const result = columnFiltersStateSchema.safeParse(JSON.parse(value));
        return result.success && hasOnlyKnownColumns(result.data, knownColumnIds)
          ? result.data
          : null;
      } catch {
        return null;
      }
    },
    serialize(value) {
      return JSON.stringify(value);
    },
    eq(a, b) {
      return JSON.stringify(a) === JSON.stringify(b);
    },
  });

  return {
    page: positiveIntegerParser.withDefault(1),
    perPage: positiveIntegerParser.withDefault(defaultPageSize),
    sort: sortingParser.withDefault(defaultSorting),
    filters: filtersParser.withDefault([]),
  };
}

export type DataTableParsers = ReturnType<typeof createDataTableParsers>;
