CREATE TABLE "allowlist_grant" (
	"id" text PRIMARY KEY,
	"subject_user_id" text NOT NULL,
	"granting_organization_id" text,
	"granting_organization_id_snapshot" text NOT NULL,
	"granting_organization_slug_snapshot" text NOT NULL,
	"granting_organization_name_snapshot" text NOT NULL,
	"allowed_organization_id" text NOT NULL,
	"granted_by_membership_id" text,
	"granted_by_user_id_snapshot" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "allowlist_grant_distinct_organizations_check" CHECK ("granting_organization_id_snapshot" <> "allowed_organization_id")
);
--> statement-breakpoint
CREATE TABLE "membership_role" (
	"membership_id" text NOT NULL,
	"role_id" text NOT NULL,
	"assigned_by_membership_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_role_assignment" (
	"user_id" text NOT NULL,
	"role_id" text NOT NULL,
	"assigned_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "role_key_idx";--> statement-breakpoint
ALTER TABLE "authorization_audit" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "authorization_audit" ADD COLUMN "organization_id_snapshot" text;--> statement-breakpoint
ALTER TABLE "authorization_audit" ADD COLUMN "organization_slug_snapshot" text;--> statement-breakpoint
ALTER TABLE "authorization_audit" ADD COLUMN "organization_name_snapshot" text;--> statement-breakpoint
ALTER TABLE "authorization_audit" ADD COLUMN "actor_membership_id" text;--> statement-breakpoint
ALTER TABLE "authorization_audit" ADD COLUMN "outcome" text NOT NULL;--> statement-breakpoint
ALTER TABLE "authorization_audit" ADD COLUMN "reason_code" text;--> statement-breakpoint
ALTER TABLE "authorization_audit" ADD COLUMN "correlation_id" text;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "suspended_at" timestamp;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "suspended_by_user_id" text;--> statement-breakpoint
ALTER TABLE "permission" ADD COLUMN "category" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "permission" ADD COLUMN "scope" text NOT NULL;--> statement-breakpoint
ALTER TABLE "permission" ADD COLUMN "is_protected" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "role" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "role" ADD COLUMN "is_protected" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_organization_restricted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "managing_organization_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "managing_organization_id_snapshot" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "managing_organization_slug_snapshot" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "managing_organization_name_snapshot" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "allowlist_frozen_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "allowlist_grant_subject_allowed_organization_idx" ON "allowlist_grant" ("subject_user_id","allowed_organization_id");--> statement-breakpoint
CREATE INDEX "allowlist_grant_subject_user_id_idx" ON "allowlist_grant" ("subject_user_id");--> statement-breakpoint
CREATE INDEX "allowlist_grant_granting_organization_id_idx" ON "allowlist_grant" ("granting_organization_id");--> statement-breakpoint
CREATE INDEX "allowlist_grant_allowed_organization_id_idx" ON "allowlist_grant" ("allowed_organization_id");--> statement-breakpoint
CREATE INDEX "authorization_audit_organization_created_at_idx" ON "authorization_audit" ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "authorization_audit_actor_user_id_idx" ON "authorization_audit" ("actor_user_id");--> statement-breakpoint
CREATE INDEX "authorization_audit_actor_membership_id_idx" ON "authorization_audit" ("actor_membership_id");--> statement-breakpoint
CREATE INDEX "authorization_audit_target_idx" ON "authorization_audit" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "authorization_audit_action_idx" ON "authorization_audit" ("action");--> statement-breakpoint
CREATE INDEX "authorization_audit_correlation_id_idx" ON "authorization_audit" ("correlation_id");--> statement-breakpoint
CREATE INDEX "member_userId_status_idx" ON "member" ("user_id","status");--> statement-breakpoint
CREATE INDEX "member_organizationId_status_idx" ON "member" ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_role_membership_role_idx" ON "membership_role" ("membership_id","role_id");--> statement-breakpoint
CREATE INDEX "membership_role_role_id_idx" ON "membership_role" ("role_id");--> statement-breakpoint
CREATE INDEX "membership_role_assigned_by_membership_id_idx" ON "membership_role" ("assigned_by_membership_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_role_assignment_user_role_idx" ON "platform_role_assignment" ("user_id","role_id");--> statement-breakpoint
CREATE INDEX "platform_role_assignment_role_id_idx" ON "platform_role_assignment" ("role_id");--> statement-breakpoint
CREATE INDEX "platform_role_assignment_assigned_by_user_id_idx" ON "platform_role_assignment" ("assigned_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_protected_key_idx" ON "role" ("key") WHERE "is_protected" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "role_organization_key_idx" ON "role" ("organization_id","key") WHERE "is_protected" = false;--> statement-breakpoint
CREATE INDEX "role_organization_id_idx" ON "role" ("organization_id");--> statement-breakpoint
CREATE INDEX "user_managing_organization_id_idx" ON "user" ("managing_organization_id");--> statement-breakpoint
CREATE INDEX "user_disabled_at_idx" ON "user" ("disabled_at");--> statement-breakpoint
ALTER TABLE "allowlist_grant" ADD CONSTRAINT "allowlist_grant_subject_user_id_user_id_fkey" FOREIGN KEY ("subject_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "allowlist_grant" ADD CONSTRAINT "allowlist_grant_granting_organization_id_organization_id_fkey" FOREIGN KEY ("granting_organization_id") REFERENCES "organization"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "allowlist_grant" ADD CONSTRAINT "allowlist_grant_allowed_organization_id_organization_id_fkey" FOREIGN KEY ("allowed_organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "allowlist_grant" ADD CONSTRAINT "allowlist_grant_granted_by_membership_id_member_id_fkey" FOREIGN KEY ("granted_by_membership_id") REFERENCES "member"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "authorization_audit" ADD CONSTRAINT "authorization_audit_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "authorization_audit" ADD CONSTRAINT "authorization_audit_actor_membership_id_member_id_fkey" FOREIGN KEY ("actor_membership_id") REFERENCES "member"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_suspended_by_user_id_user_id_fkey" FOREIGN KEY ("suspended_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "membership_role" ADD CONSTRAINT "membership_role_membership_id_member_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "member"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "membership_role" ADD CONSTRAINT "membership_role_role_id_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "membership_role" ADD CONSTRAINT "membership_role_assigned_by_membership_id_member_id_fkey" FOREIGN KEY ("assigned_by_membership_id") REFERENCES "member"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "platform_role_assignment" ADD CONSTRAINT "platform_role_assignment_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "platform_role_assignment" ADD CONSTRAINT "platform_role_assignment_role_id_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "platform_role_assignment" ADD CONSTRAINT "platform_role_assignment_assigned_by_user_id_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "role" ADD CONSTRAINT "role_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_managing_organization_id_organization_id_fkey" FOREIGN KEY ("managing_organization_id") REFERENCES "organization"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_status_check" CHECK ("status" IN ('active', 'suspended'));--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_suspension_state_check" CHECK (("status" = 'active' AND "suspended_at" IS NULL AND "suspended_by_user_id" IS NULL) OR ("status" = 'suspended' AND "suspended_at" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "permission" ADD CONSTRAINT "permission_scope_check" CHECK ("scope" IN ('platform', 'organization'));--> statement-breakpoint
ALTER TABLE "role" ADD CONSTRAINT "role_protection_ownership_check" CHECK (("is_protected" = true AND "organization_id" IS NULL) OR ("is_protected" = false AND "organization_id" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_organization_restriction_state_check" CHECK (("is_organization_restricted" = false AND "managing_organization_id" IS NULL AND "managing_organization_id_snapshot" IS NULL AND "managing_organization_slug_snapshot" IS NULL AND "managing_organization_name_snapshot" IS NULL AND "allowlist_frozen_at" IS NULL) OR ("is_organization_restricted" = true AND "managing_organization_id_snapshot" IS NOT NULL AND "managing_organization_slug_snapshot" IS NOT NULL AND "managing_organization_name_snapshot" IS NOT NULL AND (("managing_organization_id" IS NOT NULL AND "allowlist_frozen_at" IS NULL) OR ("managing_organization_id" IS NULL AND "allowlist_frozen_at" IS NOT NULL))));