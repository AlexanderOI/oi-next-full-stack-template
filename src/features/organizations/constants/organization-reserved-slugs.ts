export const ORGANIZATION_RESERVED_SLUGS = [
  "admin",
  "api",
  "auth",
  "dashboard",
  "forbidden",
  "org",
  "profile",
  "forgot-password",
  "reset-password",
  "sign-in",
  "sign-up",
  "roles",
  "users",
] as const;

const reservedOrganizationSlugs = new Set<string>(ORGANIZATION_RESERVED_SLUGS);

export function isReservedOrganizationSlug(normalizedSlug: string): boolean {
  if (!normalizedSlug) return false;

  return reservedOrganizationSlugs.has(normalizedSlug.toLowerCase());
}
