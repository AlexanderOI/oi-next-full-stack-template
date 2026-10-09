ALTER TABLE "role" ADD COLUMN "scope" text NOT NULL;--> statement-breakpoint
DROP INDEX "role_protected_key_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "role_protected_key_idx" ON "role" ("scope","key") WHERE "is_protected" = true;--> statement-breakpoint
ALTER TABLE "role" ADD CONSTRAINT "role_scope_check" CHECK ("scope" IN ('platform', 'organization'));--> statement-breakpoint
ALTER TABLE "role" DROP CONSTRAINT "role_protection_ownership_check", ADD CONSTRAINT "role_protection_ownership_check" CHECK (("is_protected" = true AND "organization_id" IS NULL) OR ("is_protected" = false AND "scope" = 'organization' AND "organization_id" IS NOT NULL));