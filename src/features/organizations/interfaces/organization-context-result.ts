import type { OrganizationErrorCode } from "./organization-error-code";
import type { OrganizationContext } from "./organization-context";

export type OrganizationContextResult =
  | { ok: true; context: OrganizationContext }
  | {
      ok: false;
      error: "ORGANIZATION_CONTEXT_REQUIRED";
      target: Pick<
        OrganizationContext,
        "organizationId" | "organizationSlug" | "organizationName" | "membershipId"
      >;
    }
  | {
      ok: false;
      error: "ORGANIZATION_CONTEXT_MISMATCH";
      target: Pick<
        OrganizationContext,
        "organizationId" | "organizationSlug" | "organizationName" | "membershipId"
      >;
      active: Pick<
        OrganizationContext,
        "organizationId" | "organizationSlug" | "organizationName" | "membershipId"
      >;
    }
  | {
      ok: false;
      error: Exclude<
        OrganizationErrorCode,
        "ORGANIZATION_CONTEXT_REQUIRED" | "ORGANIZATION_CONTEXT_MISMATCH"
      >;
    };
