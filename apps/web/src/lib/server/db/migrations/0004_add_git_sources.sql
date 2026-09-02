CREATE TABLE "git_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"connection_id" text,
	"provider" text NOT NULL,
	"repo_slug" text NOT NULL,
	"clone_url" text NOT NULL,
	"branch" text DEFAULT 'main' NOT NULL,
	"sha_deployed" text,
	"active_color" text,
	"warm_color" text,
	"warm_expires_at" timestamp with time zone,
	"last_push_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "git_sources_app_id_unique" UNIQUE("app_id")
);
--> statement-breakpoint
ALTER TABLE "apps" ADD COLUMN "active_color" text;--> statement-breakpoint
ALTER TABLE "git_sources" ADD CONSTRAINT "git_sources_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "git_sources" ADD CONSTRAINT "git_sources_connection_id_git_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."git_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "git_sources_app_idx" ON "git_sources" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "git_sources_connection_idx" ON "git_sources" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "git_sources_provider_idx" ON "git_sources" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "git_sources_last_push_idx" ON "git_sources" USING btree ("last_push_at");