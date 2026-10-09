import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";

import {
  allowlistGrant,
  authorizationAudit,
  invitation,
  member,
  membershipRole,
  organization,
  permission,
  platformRoleAssignment,
  role,
  schema,
  session,
  user,
} from "@/db/schema";

describe("Better Auth organization schema", () => {
  it("exports the canonical organization models and active session field", () => {
    expect(schema).toMatchObject({ organization, member, invitation, session });
    expect(Object.keys(organization)).toContain("slug");
    expect(Object.keys(member)).toContain("organizationId");
    expect(Object.keys(member)).toContain("userId");
    expect(Object.keys(invitation)).toContain("inviterId");
    expect(Object.keys(session)).toContain("activeOrganizationId");
  });

  it("stores the private initial organization marker with set-null organization ownership", () => {
    const userConfig = getTableConfig(user);

    expect(user).toHaveProperty("initialActiveOrganizationId");
    expect(userConfig.foreignKeys).toEqual(
      expect.arrayContaining([expect.objectContaining({ onDelete: "set null" })])
    );
  });

  it("stores unique, nullable public-signup provenance tied to the owning identity", () => {
    const organizationConfig = getTableConfig(organization);

    const provenanceColumn = organizationConfig.columns.find(
      (column) => column.name === "personal_signup_owner_user_id"
    );
    expect(provenanceColumn?.notNull).toBe(false);
    expect(organizationConfig.indexes).toContainEqual(
      expect.objectContaining({
        config: expect.objectContaining({
          name: "organization_personal_signup_owner_user_id_idx",
          unique: true,
        }),
      })
    );
    expect(
      organizationConfig.foreignKeys.some((foreignKey) => {
        const reference = foreignKey.reference();
        return (
          reference.columns[0]?.name === "personal_signup_owner_user_id" &&
          reference.foreignColumns[0]?.name === "id" &&
          foreignKey.onDelete === "set null"
        );
      })
    ).toBe(true);
  });

  it("enforces a single pending invitation per organization and normalized email", () => {
    const invitationConfig = getTableConfig(invitation);

    expect(invitationConfig.indexes).toContainEqual(
      expect.objectContaining({
        config: expect.objectContaining({
          name: "invitation_pending_organization_email_idx",
          unique: true,
          where: expect.anything(),
        }),
      })
    );
  });

  it("enforces unique organization slugs and organization membership pairs", () => {
    const organizationConfig = getTableConfig(organization);
    const memberConfig = getTableConfig(member);

    expect(organizationConfig.indexes).toContainEqual(
      expect.objectContaining({
        config: expect.objectContaining({
          name: "organization_slug_idx",
          unique: true,
        }),
      })
    );
    expect(memberConfig.indexes).toContainEqual(
      expect.objectContaining({
        config: expect.objectContaining({
          name: "member_organizationId_userId_idx",
          unique: true,
        }),
      })
    );
  });

  it("keeps membership and invitation rows related to canonical organizations and identities", () => {
    const memberConfig = getTableConfig(member);
    const invitationConfig = getTableConfig(invitation);

    expect(memberConfig.foreignKeys).toHaveLength(3);
    expect(invitationConfig.foreignKeys).toHaveLength(2);
    expect(memberConfig.foreignKeys.map((foreignKey) => foreignKey.onDelete)).toEqual(
      expect.arrayContaining(["cascade", "cascade", "set null"])
    );
    expect(getTableConfig(session).indexes.map((index) => index.config.name)).toContain(
      "session_userId_activeOrganizationId_idx"
    );
  });

  it("separates platform assignments from membership-scoped organization assignments", () => {
    expect(Object.keys(schema)).toEqual(
      expect.arrayContaining(["platformRoleAssignment", "membershipRole"])
    );
    expect(Object.keys(schema)).not.toContain("userRole");

    const platformConfig = getTableConfig(platformRoleAssignment);
    const membershipRoleConfig = getTableConfig(membershipRole);

    expect(platformConfig.indexes).toContainEqual(
      expect.objectContaining({ config: expect.objectContaining({ unique: true }) })
    );
    expect(membershipRoleConfig.indexes).toContainEqual(
      expect.objectContaining({ config: expect.objectContaining({ unique: true }) })
    );
    expect(membershipRoleConfig.foreignKeys).toHaveLength(3);
    expect(platformConfig.foreignKeys).toHaveLength(3);
    expect(platformRoleAssignment).toHaveProperty("assignedByUserId");
    expect(platformConfig.indexes.map((index) => index.config.name)).toContain(
      "platform_role_assignment_user_role_idx"
    );
    expect(membershipRoleConfig.indexes.map((index) => index.config.name)).toContain(
      "membership_role_membership_role_idx"
    );
  });

  it("enforces scoped role keys and permission scope metadata", () => {
    const roleConfig = getTableConfig(role);
    const permissionConfig = getTableConfig(permission);
    const roleColumns = Object.values(role);
    const permissionColumns = Object.values(permission);

    expect(roleConfig.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "role_protected_key_idx",
        "role_organization_key_idx",
        "role_platform_key_idx",
      ])
    );
    expect(
      roleConfig.indexes.find((index) => index.config.name === "role_key_idx")
    ).toBeUndefined();
    expect(permission).toHaveProperty("scope");
    expect(permission).toHaveProperty("isProtected");
    expect(permissionConfig.checks.map((constraint) => constraint.name)).toContain(
      "permission_scope_check"
    );
    expect(permission.scope.default).toBe("platform");
    expect(role.scope.default).toBe("platform");
    expect(roleConfig.checks.map((constraint) => constraint.name)).toContain(
      "role_protection_ownership_check"
    );
    expect(role).toHaveProperty("scope");
    expect(role).toHaveProperty("organizationId");
    expect(role).toHaveProperty("isProtected");
    expect(roleConfig.checks.map((constraint) => constraint.name)).toContain("role_scope_check");
    expect(roleColumns).toContain(role.scope);
    expect(permissionColumns).toContain(permission.scope);
  });

  it("defaults omitted authorization audit outcomes to successful writes", () => {
    expect(authorizationAudit.outcome.default).toBe("success");
  });

  it("stores immutable restriction snapshots and member lifecycle state", () => {
    expect(user).toHaveProperty("isOrganizationRestricted");
    expect(user).toHaveProperty("managingOrganizationId");
    expect(user).toHaveProperty("managingOrganizationIdSnapshot");
    expect(user).toHaveProperty("managingOrganizationSlugSnapshot");
    expect(user).toHaveProperty("managingOrganizationNameSnapshot");
    expect(user).toHaveProperty("allowlistFrozenAt");
    expect(member).toHaveProperty("status");
    expect(member).toHaveProperty("suspendedAt");
    expect(member).toHaveProperty("suspendedByUserId");

    const userConfig = getTableConfig(user);
    const userManagerFk = userConfig.foreignKeys.find(
      (foreignKey) => foreignKey.reference().columns[0]?.name === "managing_organization_id"
    );
    expect(userManagerFk?.onDelete).toBe("set null");
  });

  it("preserves immutable allowlist and audit evidence with the intended deletion policies", () => {
    expect(allowlistGrant).toHaveProperty("grantingOrganizationIdSnapshot");
    expect(allowlistGrant).toHaveProperty("grantingOrganizationSlugSnapshot");
    expect(allowlistGrant).toHaveProperty("grantingOrganizationNameSnapshot");
    expect(allowlistGrant).toHaveProperty("grantedByUserIdSnapshot");
    expect(Object.keys(allowlistGrant)).not.toEqual(
      expect.arrayContaining(["revokedAt", "revokedByUserId"])
    );

    const grantConfig = getTableConfig(allowlistGrant);
    expect(grantConfig.foreignKeys).toHaveLength(4);
    expect(grantConfig.foreignKeys.map((foreignKey) => foreignKey.onDelete)).toEqual(
      expect.arrayContaining(["cascade", "set null", "cascade", "set null"])
    );
    expect(grantConfig.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "allowlist_grant_subject_user_id_idx",
        "allowlist_grant_granting_organization_id_idx",
        "allowlist_grant_allowed_organization_id_idx",
      ])
    );

    expect(authorizationAudit).toHaveProperty("organizationId");
    expect(authorizationAudit).toHaveProperty("organizationIdSnapshot");
    expect(authorizationAudit).toHaveProperty("actorMembershipId");
    expect(authorizationAudit).toHaveProperty("outcome");
    expect(authorizationAudit).toHaveProperty("reasonCode");
    expect(authorizationAudit).toHaveProperty("correlationId");
    const auditConfig = getTableConfig(authorizationAudit);
    expect(auditConfig.foreignKeys.length).toBeGreaterThanOrEqual(3);
    expect(auditConfig.foreignKeys.map((foreignKey) => foreignKey.onDelete)).toEqual(
      expect.arrayContaining(["set null", "set null", "set null"])
    );
  });
});
