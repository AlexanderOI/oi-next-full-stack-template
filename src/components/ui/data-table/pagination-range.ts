export type PaginationItem = number | "ellipsis";

export function getPaginationRange(
  currentPage: number,
  pageCount: number,
  siblingCount = 1
): PaginationItem[] {
  if (pageCount <= 0) return [];

  const current = Math.min(Math.max(currentPage, 1), pageCount);
  const visiblePages = new Set([1, pageCount]);

  for (
    let page = Math.max(2, current - siblingCount);
    page <= Math.min(pageCount - 1, current + siblingCount);
    page += 1
  ) {
    visiblePages.add(page);
  }

  const pages = [...visiblePages].sort((a, b) => a - b);
  const range: PaginationItem[] = [];

  pages.forEach((page, index) => {
    const previousPage = pages[index - 1];
    if (previousPage && page - previousPage > 1) range.push("ellipsis");
    range.push(page);
  });

  return range;
}
