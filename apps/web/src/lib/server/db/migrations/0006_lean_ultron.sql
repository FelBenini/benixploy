CREATE TABLE "push_events" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text,
	"connection_id" text,
	"provider" text NOT NULL,
	"repo_slug" text NOT NULL,
	"branch" text NOT NULL,
	"ref" text NOT NULL,
	"sha" text NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"delivery_id" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"deploy_job_id" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "push_events" ADD CONSTRAINT "push_events_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_events" ADD CONSTRAINT "push_events_connection_id_git_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."git_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_events_app_received_idx" ON "push_events" USING btree ("app_id","received_at");--> statement-breakpoint
CREATE INDEX "push_events_connection_idx" ON "push_events" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "push_events_delivery_idx" ON "push_events" USING btree ("delivery_id");