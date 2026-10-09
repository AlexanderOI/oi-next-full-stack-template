import { defineRelations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
  primaryKey,
  jsonb,
  check,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    username: text("username").unique(),
    displayUsername: text("display_username"),
    locale: text("locale"),
    invitedAt: timestamp("invited_at"),
    disabledAt: timestamp("disabled_at"),
    initialActiveOrganizationId: text("initial_active_organization_id").references(
      (): AnyPgColumn => organization.id,
      { onDelete: "set null" }
    ),
    isOrganizationRestricted: boolean("is_organization_restricted").default(false).notNull(),

    managingOrganizationId: text("managing_organization_id").references(
      (): AnyPgColumn => organization.id,
      {
        onDelete: "set null",
      }
    ),
    managingOrganizationIdSnapshot: text("managing_organization_id_snapshot"),
    managingOrganizationSlugSnapshot: text("managing_organization_slug_snapshot"),
    managingOrganizationNameSnapshot: text("managing_organization_name_snapshot"),
    allowlistFrozenAt: timestamp("allowlist_frozen_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("user_managing_organization_id_idx").on(table.managingOrganizationId),
    index("user_disabled_at_idx").on(table.disabledAt),
    index("user_initial_active_organization_id_idx").on(table.initialActiveOrganizationId),
    check(
      "user_organization_restriction_state_check",
      sql`(${table.isOrganizationRestricted} = false AND ${table.managingOrganizationId} IS NULL AND ${table.managingOrganizationIdSnapshot} IS NULL AND ${table.managingOrganizationSlugSnapshot} IS NULL AND ${table.managingOrganizationNameSnapshot} IS NULL AND ${table.allowlistFrozenAt} IS NULL) OR (${table.isOrganizationRestricted} = true AND ${table.managingOrganizationIdSnapshot} IS NOT NULL AND ${table.managingOrganizationSlugSnapshot} IS NOT NULL AND ${table.managingOrganizationNameSnapshot} IS NOT NULL AND ((${table.managingOrganizationId} IS NOT NULL AND ${table.allowlistFrozenAt} IS NULL) OR (${table.managingOrganizationId} IS NULL AND ${table.allowlistFrozenAt} IS NOT NULL)))`
    ),
  ]
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    activeOrganizationId: text("active_organization_id"),
  },
  (table) => [
    index("session_userId_idx").on(table.userId),
    index("session_userId_activeOrganizationId_idx").on(table.userId, table.activeOrganizationId),
  ]
);

export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    logo: text("logo"),
    metadata: text("metadata"),
    personalSignupOwnerUserId: text("personal_signup_owner_user_id").references(
      (): AnyPgColumn => user.id,
      {
        onDelete: "set null",
      }
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("organization_slug_idx").on(table.slug),
    uniqueIndex("organization_personal_signup_owner_user_id_idx").on(
      table.personalSignupOwnerUserId
    ),
  ]
);

export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    status: text("status").notNull().default("active"),
    suspendedAt: timestamp("suspended_at"),
    suspendedByUserId: text("suspended_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("member_organizationId_userId_idx").on(table.organizationId, table.userId),
    index("member_userId_idx").on(table.userId),
    index("member_organizationId_idx").on(table.organizationId),
    index("member_userId_status_idx").on(table.userId, table.status),
    index("member_organizationId_status_idx").on(table.organizationId, table.status),
    check("member_status_check", sql`${table.status} IN ('active', 'suspended')`),
    check(
      "member_suspension_state_check",
      sql`(${table.status} = 'active' AND ${table.suspendedAt} IS NULL AND ${table.suspendedByUserId} IS NULL) OR (${table.status} = 'suspended' AND ${table.suspendedAt} IS NOT NULL)`
    ),
  ]
);

export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at").notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("invitation_organizationId_status_expiresAt_idx").on(
      table.organizationId,
      table.status,
      table.expiresAt
    ),
    index("invitation_email_status_idx").on(table.email, table.status),
    uniqueIndex("invitation_pending_organization_email_idx")
      .on(table.organizationId, table.email)
      .where(sql`${table.status} = 'pending'`),
  ]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)]
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);

export const permission = pgTable(
  "permission",
  {
    key: text("key").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull().default(""),
    scope: text("scope").notNull().default("platform"),
    isProtected: boolean("is_protected").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [check("permission_scope_check", sql`${table.scope} IN ('platform', 'organization')`)]
);

export const role = pgTable(
  "role",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    isSystem: boolean("is_system").notNull().default(false),
    scope: text("scope").notNull().default("platform"),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    isProtected: boolean("is_protected").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("role_protected_key_idx")
      .on(table.scope, table.key)
      .where(sql`${table.isProtected} = true`),
    uniqueIndex("role_organization_key_idx")
      .on(table.organizationId, table.key)
      .where(sql`${table.isProtected} = false`),
    index("role_organization_id_idx").on(table.organizationId),
    check("role_scope_check", sql`${table.scope} IN ('platform', 'organization')`),
    uniqueIndex("role_platform_key_idx")
      .on(table.scope, table.key)
      .where(sql`${table.scope} = 'platform'`),
    check(
      "role_protection_ownership_check",
      sql`(${table.isProtected} = true AND ${table.organizationId} IS NULL) OR (${table.isProtected} = false AND ((${table.scope} = 'platform' AND ${table.organizationId} IS NULL) OR (${table.scope} = 'organization' AND ${table.organizationId} IS NOT NULL)))`
    ),
  ]
);

export const rolePermission = pgTable(
  "role_permission",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => role.id, { onDelete: "cascade" }),
    permissionKey: text("permission_key")
      .notNull()
      .references(() => permission.key, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionKey] })]
);

export const platformRoleAssignment = pgTable(
  "platform_role_assignment",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => role.id, { onDelete: "cascade" }),
    assignedByUserId: text("assigned_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("platform_role_assignment_user_role_idx").on(table.userId, table.roleId),
    index("platform_role_assignment_role_id_idx").on(table.roleId),
    index("platform_role_assignment_assigned_by_user_id_idx").on(table.assignedByUserId),
  ]
);

export const membershipRole = pgTable(
  "membership_role",
  {
    membershipId: text("membership_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => role.id, { onDelete: "cascade" }),
    assignedByMembershipId: text("assigned_by_membership_id").references(() => member.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("membership_role_membership_role_idx").on(table.membershipId, table.roleId),
    index("membership_role_role_id_idx").on(table.roleId),
    index("membership_role_assigned_by_membership_id_idx").on(table.assignedByMembershipId),
  ]
);

export const allowlistGrant = pgTable(
  "allowlist_grant",
  {
    id: text("id").primaryKey(),
    subjectUserId: text("subject_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    grantingOrganizationId: text("granting_organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    grantingOrganizationIdSnapshot: text("granting_organization_id_snapshot").notNull(),
    grantingOrganizationSlugSnapshot: text("granting_organization_slug_snapshot").notNull(),
    grantingOrganizationNameSnapshot: text("granting_organization_name_snapshot").notNull(),
    allowedOrganizationId: text("allowed_organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    grantedByMembershipId: text("granted_by_membership_id").references(() => member.id, {
      onDelete: "set null",
    }),
    grantedByUserIdSnapshot: text("granted_by_user_id_snapshot").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("allowlist_grant_subject_allowed_organization_idx").on(
      table.subjectUserId,
      table.allowedOrganizationId
    ),
    index("allowlist_grant_subject_user_id_idx").on(table.subjectUserId),
    index("allowlist_grant_granting_organization_id_idx").on(table.grantingOrganizationId),
    index("allowlist_grant_allowed_organization_id_idx").on(table.allowedOrganizationId),
    check(
      "allowlist_grant_distinct_organizations_check",
      sql`${table.grantingOrganizationIdSnapshot} <> ${table.allowedOrganizationId}`
    ),
  ]
);

export const authorizationAudit = pgTable(
  "authorization_audit",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    organizationIdSnapshot: text("organization_id_snapshot"),
    organizationSlugSnapshot: text("organization_slug_snapshot"),
    organizationNameSnapshot: text("organization_name_snapshot"),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    actorMembershipId: text("actor_membership_id").references(() => member.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    outcome: text("outcome").notNull().default("success"),
    reasonCode: text("reason_code"),
    correlationId: text("correlation_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("authorization_audit_created_at_idx").on(table.createdAt),
    index("authorization_audit_organization_created_at_idx").on(
      table.organizationId,
      table.createdAt
    ),
    index("authorization_audit_actor_user_id_idx").on(table.actorUserId),
    index("authorization_audit_actor_membership_id_idx").on(table.actorMembershipId),
    index("authorization_audit_target_idx").on(table.targetType, table.targetId),
    index("authorization_audit_action_idx").on(table.action),
    index("authorization_audit_correlation_id_idx").on(table.correlationId),
  ]
);

// Relations V2
export const schemaRelations = defineRelations({
  user: {
    sessions: {
      type: "many",
      table: session,
    },
    accounts: {
      type: "many",
      table: account,
    },
    memberships: {
      type: "many",
      table: member,
    },
    invitationsSent: {
      type: "many",
      table: invitation,
    },
    managedOrganization: {
      type: "one",
      table: organization,
      fields: [user.managingOrganizationId],
      references: [organization.id],
    },
  },

  session: {
    activeOrganization: {
      type: "one",
      table: organization,
      fields: [session.activeOrganizationId],
      references: [organization.id],
    },
    user: {
      type: "one",
      table: user,
      fields: [session.userId],
      references: [user.id],
    },
  },

  organization: {
    members: {
      type: "many",
      table: member,
    },
    invitations: {
      type: "many",
      table: invitation,
    },
    roles: {
      type: "many",
      table: role,
    },
    managedUsers: {
      type: "many",
      table: user,
    },
  },

  member: {
    organization: {
      type: "one",
      table: organization,
      fields: [member.organizationId],
      references: [organization.id],
    },
    user: {
      type: "one",
      table: user,
      fields: [member.userId],
      references: [user.id],
    },
    roleAssignments: {
      type: "many",
      table: membershipRole,
    },
  },

  invitation: {
    organization: {
      type: "one",
      table: organization,
      fields: [invitation.organizationId],
      references: [organization.id],
    },
    inviter: {
      type: "one",
      table: user,
      fields: [invitation.inviterId],
      references: [user.id],
    },
  },

  account: {
    user: {
      type: "one",
      table: user,
      fields: [account.userId],
      references: [user.id],
    },
  },

  role: {
    organization: {
      type: "one",
      table: organization,
      fields: [role.organizationId],
      references: [organization.id],
    },
    membershipAssignments: {
      type: "many",
      table: membershipRole,
    },
  },

  platformRoleAssignment: {
    user: {
      type: "one",
      table: user,
      fields: [platformRoleAssignment.userId],
      references: [user.id],
    },
    role: {
      type: "one",
      table: role,
      fields: [platformRoleAssignment.roleId],
      references: [role.id],
    },
    assignedBy: {
      type: "one",
      table: user,
      fields: [platformRoleAssignment.assignedByUserId],
      references: [user.id],
    },
  },

  membershipRole: {
    membership: {
      type: "one",
      table: member,
      fields: [membershipRole.membershipId],
      references: [member.id],
    },
    role: {
      type: "one",
      table: role,
      fields: [membershipRole.roleId],
      references: [role.id],
    },
    assignedByMembership: {
      type: "one",
      table: member,
      fields: [membershipRole.assignedByMembershipId],
      references: [member.id],
    },
  },

  allowlistGrant: {
    subject: {
      type: "one",
      table: user,
      fields: [allowlistGrant.subjectUserId],
      references: [user.id],
    },
    grantingOrganization: {
      type: "one",
      table: organization,
      fields: [allowlistGrant.grantingOrganizationId],
      references: [organization.id],
    },
    allowedOrganization: {
      type: "one",
      table: organization,
      fields: [allowlistGrant.allowedOrganizationId],
      references: [organization.id],
    },
    grantedByMembership: {
      type: "one",
      table: member,
      fields: [allowlistGrant.grantedByMembershipId],
      references: [member.id],
    },
  },

  authorizationAudit: {
    organization: {
      type: "one",
      table: organization,
      fields: [authorizationAudit.organizationId],
      references: [organization.id],
    },
    actor: {
      type: "one",
      table: user,
      fields: [authorizationAudit.actorUserId],
      references: [user.id],
    },
    actorMembership: {
      type: "one",
      table: member,
      fields: [authorizationAudit.actorMembershipId],
      references: [member.id],
    },
  },
});

export const schema = {
  user,
  session,
  organization,
  member,
  invitation,
  account,
  verification,
  permission,
  role,
  rolePermission,
  platformRoleAssignment,
  membershipRole,
  allowlistGrant,
  authorizationAudit,
};
