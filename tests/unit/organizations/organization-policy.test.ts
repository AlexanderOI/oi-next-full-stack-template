import { describe, expect, it } from "vitest";

import { permissionCatalog, PERMISSIONS } from "@/features/authorization/contracts";
import {
  MAX_ACTIVE_MEMBERS_PER_ORGANIZATION,
  MAX_ORGANIZATIONS_PER_USER,
  ORGANIZATION_INVITATION_LIFETIME_DAYS,
} from "@/features/organizations/constants/organization-limits";
import {
  isReservedOrganizationSlug,
  ORGANIZATION_RESERVED_SLUGS,
} from "@/features/organizations/constants/organization-reserved-slugs";
import {
  MAX_ORGANIZATION_SLUG_LENGTH,
  normalizeOrganizationSlug,
} from "@/features/organizations/utils/normalize-organization-slug";
import { organizationSlugSchema } from "@/features/organizations/schemas/organization-slug-schema";
import type { OrganizationErrorCode, OrganizationResult } from "@/features/organizations/contracts";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";

describe("organization policy", () => {
  it("uses the confirmed organization and invitation limits", () => {
    expect(MAX_ORGANIZATIONS_PER_USER).toBe(100);
    expect(MAX_ACTIVE_MEMBERS_PER_ORGANIZATION).toBe(1_000);
    expect(ORGANIZATION_INVITATION_LIFETIME_DAYS).toBe(2);
  });

  it("normalizes organization slugs independently and deterministically", () => {
    expect(normalizeOrganizationSlug("  Crème BRÛLÉE  ")).toBe("creme-brulee");
    expect(normalizeOrganizationSlug("North___STAR...Labs")).toBe("north-star-labs");
    expect(normalizeOrganizationSlug("ＡＣＭＥ")).toBe("acme");
    expect(normalizeOrganizationSlug("東京")).toBe("");
    expect(normalizeOrganizationSlug("---")).toBe("");
  });

  it("enforces a stable maximum normalized slug length", () => {
    const normalized = normalizeOrganizationSlug("A".repeat(100));

    expect(MAX_ORGANIZATION_SLUG_LENGTH).toBe(63);
    expect(normalized).toBe("a".repeat(63));
    expect(normalized).toHaveLength(MAX_ORGANIZATION_SLUG_LENGTH);
  });

  it("reserves names from current route namespaces and auth/admin endpoints", () => {
    expect(ORGANIZATION_RESERVED_SLUGS).toEqual([
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
    ]);
    expect(isReservedOrganizationSlug(normalizeOrganizationSlug(" ADMIN "))).toBe(true);
    expect(isReservedOrganizationSlug("ADMIN")).toBe(true);
    expect(isReservedOrganizationSlug(normalizeOrganizationSlug("Sign In"))).toBe(true);
    expect(isReservedOrganizationSlug("acme-labs")).toBe(false);
    expect(isReservedOrganizationSlug("")).toBe(false);
  });

  it("rejects invalid normalized slugs before persistence", () => {
    expect(organizationSlugSchema.safeParse("東京").success).toBe(false);
    expect(organizationSlugSchema.safeParse("---").success).toBe(false);
    expect(organizationSlugSchema.safeParse("admin").success).toBe(false);
    expect(organizationSlugSchema.safeParse("a".repeat(64)).success).toBe(false);
    expect(organizationSlugSchema.parse(" Crème BRÛLÉE ")).toBe("creme-brulee");
  });

  it("exposes stable organization result and error contracts", () => {
    const code: OrganizationErrorCode = "VALIDATION_ERROR";
    const success: OrganizationResult<{ id: string }> = {
      success: true,
      data: { id: "org-1" },
    };
    const failure: OrganizationResult<{ id: string }> = { success: false, code };

    expect(success).toEqual({ success: true, data: { id: "org-1" } });
    expect(failure).toEqual({ success: false, code: "VALIDATION_ERROR" });
  });

  it("catalogs organization authority without platform permission inheritance", () => {
    const organizationSections = permissionCatalog.filter((section) =>
      section.key.startsWith("organization")
    );
    const organizationPermissions = organizationSections.flatMap((section) => section.permissions);

    expect(organizationSections.map(({ key }) => key)).toEqual([
      "organization",
      "organization-members",
      "organization-roles",
      "organization-invitations",
      "organization-security",
    ]);
    expect(organizationPermissions.map(({ key }) => key)).toEqual(
      expect.arrayContaining([
        PERMISSIONS.ORGANIZATION_READ,
        PERMISSIONS.ORGANIZATION_UPDATE,
        PERMISSIONS.ORGANIZATION_DELETE,
        PERMISSIONS.ORGANIZATION_AUDIT_READ,
        PERMISSIONS.ORGANIZATION_MEMBERS_READ,
        PERMISSIONS.ORGANIZATION_MEMBERS_PROVISION,
        PERMISSIONS.ORGANIZATION_MEMBER_ACCESS_UPDATE,
        PERMISSIONS.ORGANIZATION_MEMBERS_REMOVE,
        PERMISSIONS.ORGANIZATION_OWNERSHIP_TRANSFER,
        PERMISSIONS.ORGANIZATION_ROLES_READ,
        PERMISSIONS.ORGANIZATION_ROLES_CREATE,
        PERMISSIONS.ORGANIZATION_ROLES_UPDATE,
        PERMISSIONS.ORGANIZATION_ROLES_DELETE,
        PERMISSIONS.ORGANIZATION_MEMBER_ROLES_UPDATE,
        PERMISSIONS.ORGANIZATION_INVITATIONS_READ,
        PERMISSIONS.ORGANIZATION_INVITATIONS_CREATE,
        PERMISSIONS.ORGANIZATION_INVITATIONS_CANCEL,
        PERMISSIONS.ORGANIZATION_INVITATIONS_RESEND,
        PERMISSIONS.ORGANIZATION_RESTRICTIONS_CREATE,
        PERMISSIONS.ORGANIZATION_ALLOWLIST_GRANTS_READ,
        PERMISSIONS.ORGANIZATION_ALLOWLIST_GRANTS_CREATE,
      ])
    );
    expect(new Set(organizationPermissions.map(({ key }) => key))).toHaveLength(
      organizationPermissions.length
    );
    expect(organizationPermissions.every(({ scope }) => scope === "organization")).toBe(true);
    expect(
      organizationSections
        .find(({ key }) => key === "organization-security")
        ?.permissions.every(({ isProtected }) => isProtected)
    ).toBe(true);
    expect(
      organizationSections
        .filter(({ key }) => key !== "organization-security")
        .flatMap(({ permissions }) => permissions)
        .every(({ isProtected }) => !isProtected)
    ).toBe(true);
    expect(
      permissionCatalog
        .filter((section) => !section.key.startsWith("organization"))
        .flatMap((section) => section.permissions)
        .every(({ scope }) => scope === "platform")
    ).toBe(true);
    expect(PERMISSIONS).not.toHaveProperty("ORGANIZATION_ALLOWLIST_GRANTS_DELETE");
  });

  it("localizes organization permission categories and protected administration", () => {
    expect(en.authorization.sections["organization-security"]).toBe("Organization security");
    expect(es.authorization.sections["organization-security"]).toBe("Seguridad de la organización");
    expect(en.authorization.permissions.organization.restrictions.create).toEqual({
      name: "Create permanent restrictions",
      description: "Provision identities with permanent organization restrictions",
    });
    expect(es.authorization.permissions.organization["allowlist-grants"].create).toEqual({
      name: "Crear excepciones de lista de permitidos",
      description: "Crear excepciones permanentes de organización para identidades restringidas",
    });
  });
});
