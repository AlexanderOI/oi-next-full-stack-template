import type { ColumnFiltersState, PaginationState, Updater } from "@tanstack/react-table";

function resolveUpdater<T>(current: T, updater: Updater<T>) {
  return typeof updater === "function" ? (updater as (value: T) => T)(current) : updater;
}

export function getPaginationQueryUpdate(
  current: PaginationState,
  updater: Updater<PaginationState>
) {
  const next = resolveUpdater(current, updater);

  return {
    page: next.pageSize === current.pageSize ? next.pageIndex + 1 : 1,
    perPage: next.pageSize,
  };
}

export function getFilterQueryUpdate(
  current: ColumnFiltersState,
  updater: Updater<ColumnFiltersState>
) {
  return {
    filters: resolveUpdater(current, updater),
    page: 1,
  };
}
