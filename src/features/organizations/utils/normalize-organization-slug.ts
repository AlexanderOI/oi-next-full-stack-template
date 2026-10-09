export const MAX_ORGANIZATION_SLUG_LENGTH = 63;

export function normalizeOrganizationSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replaceAll(/\p{Mark}/gu, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, MAX_ORGANIZATION_SLUG_LENGTH)
    .replace(/-+$/, "");
}
