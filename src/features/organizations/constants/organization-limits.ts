export const MAX_ORGANIZATIONS_PER_USER = 100;
export const MAX_ACTIVE_MEMBERS_PER_ORGANIZATION = 1_000;
export const ORGANIZATION_INVITATION_LIFETIME_DAYS = 2;

/** Better Auth counts suspended member rows too; product handlers enforce active-member limits. */
export const AUTH_NONRESTRICTIVE_MEMBERSHIP_LIMIT = Number.MAX_SAFE_INTEGER;

/** Product policy has no pending-invitation cap; avoid Better Auth's default limit of 100. */
export const AUTH_NONRESTRICTIVE_INVITATION_LIMIT = Number.MAX_SAFE_INTEGER;
