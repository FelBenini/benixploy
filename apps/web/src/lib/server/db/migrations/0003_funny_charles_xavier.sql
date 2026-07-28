CREATE TABLE "node_events" (
	"id" text PRIMARY KEY NOT NULL,
	"server_id" text NOT NULL,
	"app_id" text,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "node_stats" (
	"id" text PRIMARY KEY NOT NULL,
	"serverId" text NOT NULL,
	"cpuPercent" double precision NOT NULL,
	"memoryTotal" bigint NOT NULL,
	"memoryUsed" bigint NOT NULL,
	"memoryAvailable" bigint NOT NULL,
	"diskTotal" bigint NOT NULL,
	"diskUsed" bigint NOT NULL,
	"uptime" bigint NOT NULL,
	"containerCount" bigint NOT NULL,
	"containerStates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"receivedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registered_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"server_id" text NOT NULL,
	"ssh_public_key" text NOT NULL,
	"monitor_bearer_token" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registered_nodes_server_id_unique" UNIQUE("server_id")
);
--> statement-breakpoint
CREATE TABLE "registration_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"server_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registration_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "compose_yaml" text;--> statement-breakpoint
ALTER TABLE "node_events" ADD CONSTRAINT "node_events_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_events" ADD CONSTRAINT "node_events_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_stats" ADD CONSTRAINT "node_stats_serverId_servers_id_fk" FOREIGN KEY ("serverId") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registered_nodes" ADD CONSTRAINT "registered_nodes_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_tokens" ADD CONSTRAINT "registration_tokens_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "node_events_server_idx" ON "node_events" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "node_events_type_idx" ON "node_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "node_events_received_idx" ON "node_events" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "node_events_server_type_idx" ON "node_events" USING btree ("server_id","event_type");--> statement-breakpoint
CREATE INDEX "node_events_server_received_idx" ON "node_events" USING btree ("server_id","received_at");--> statement-breakpoint
CREATE INDEX "node_stats_server_idx" ON "node_stats" USING btree ("serverId");--> statement-breakpoint
CREATE INDEX "node_stats_received_idx" ON "node_stats" USING btree ("receivedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "registered_nodes_server_idx" ON "registered_nodes" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "registered_nodes_status_idx" ON "registered_nodes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "registration_tokens_hash_idx" ON "registration_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "registration_tokens_expires_idx" ON "registration_tokens" USING btree ("expires_at");