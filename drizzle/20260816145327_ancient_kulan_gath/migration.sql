CREATE TABLE "account" (
	"id" text PRIMARY KEY,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "authorization_audit" (
	"id" text PRIMARY KEY,
	"actor_user_id" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission" (
	"key" text PRIMARY KEY,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role" (
	"id" text PRIMARY KEY,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permission" (
	"role_id" text,
	"permission_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "role_permission_pkey" PRIMARY KEY("role_id","permission_key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL UNIQUE,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"username" text UNIQUE,
	"display_username" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_role" (
	"user_id" text,
	"role_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_role_pkey" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" ("user_id");--> statement-breakpoint
CREATE INDEX "authorization_audit_created_at_idx" ON "authorization_audit" ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "role_key_idx" ON "role" ("key");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" ("user_id");--> statement-breakpoint
CREATE INDEX "user_role_role_id_idx" ON "user_role" ("role_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "authorization_audit" ADD CONSTRAINT "authorization_audit_actor_user_id_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_key_permission_key_fkey" FOREIGN KEY ("permission_key") REFERENCES "permission"("key") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_role_id_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE;