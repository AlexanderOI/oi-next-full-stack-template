ALTER TABLE "authorization_audit" ALTER COLUMN "outcome" SET DEFAULT 'success';--> statement-breakpoint
ALTER TABLE "permission" ALTER COLUMN "scope" SET DEFAULT 'platform';--> statement-breakpoint
ALTER TABLE "role" ALTER COLUMN "scope" SET DEFAULT 'platform';--> statement-breakpoint
CREATE UNIQUE INDEX "role_platform_key_idx" ON "role" ("scope","key") WHERE "scope" = 'platform';--> statement-breakpoint
ALTER TABLE "role" DROP CONSTRAINT "role_protection_ownership_check", ADD CONSTRAINT "role_protection_ownership_check" CHECK (("is_protected" = true AND "organization_id" IS NULL) OR ("is_protected" = false AND (("scope" = 'platform' AND "organization_id" IS NULL) OR ("scope" = 'organization' AND "organization_id" IS NOT NULL))));