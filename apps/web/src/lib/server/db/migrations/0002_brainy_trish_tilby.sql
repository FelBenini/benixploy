CREATE TABLE "git_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"name" text NOT NULL,
	"base_url" text NOT NULL,
	"auth_kind" text NOT NULL,
	"credentials_enc" text NOT NULL,
	"webhook_secret_enc" text NOT NULL,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "git_connections_provider_idx" ON "git_connections" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "git_connections_auth_kind_idx" ON "git_connections" USING btree ("auth_kind");