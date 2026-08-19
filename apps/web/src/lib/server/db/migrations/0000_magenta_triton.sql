CREATE TABLE "apps" (
	"id" text PRIMARY KEY NOT NULL,
	"orgId" text NOT NULL,
	"serverId" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"orgId" text NOT NULL,
	"actorId" text,
	"action" text NOT NULL,
	"resource" text NOT NULL,
	"resourceId" text,
	"details" jsonb,
	"reasoning" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deployments" (
	"id" text PRIMARY KEY NOT NULL,
	"appId" text NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"appSpec" jsonb NOT NULL,
	"compose_yaml" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "env_vars" (
	"id" text PRIMARY KEY NOT NULL,
	"orgId" text NOT NULL,
	"appId" text NOT NULL,
	"key" text NOT NULL,
	"encryptedValue" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "memberships" (
	"userId" text NOT NULL,
	"orgId" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orgs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orgs_slug_unique" UNIQUE("slug")
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
CREATE TABLE "servers" (
	"id" text PRIMARY KEY NOT NULL,
	"orgId" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"address" text NOT NULL,
	"sshPort" integer DEFAULT 22 NOT NULL,
	"sshUser" text DEFAULT 'root' NOT NULL,
	"sshPrivateKey" text NOT NULL,
	"status" text DEFAULT 'offline' NOT NULL,
	"cpuCores" integer NOT NULL,
	"memoryBytes" bigint NOT NULL,
	"diskBytes" bigint NOT NULL,
	"labels" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"host_key_fingerprint" text,
	"lastHeartbeatAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"secret_hash" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_setup" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"configured" boolean DEFAULT true NOT NULL,
	"setup_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"passwordHash" text NOT NULL,
	"username" text,
	"avatar_url" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "apps" ADD CONSTRAINT "apps_orgId_orgs_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apps" ADD CONSTRAINT "apps_serverId_servers_id_fk" FOREIGN KEY ("serverId") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_orgId_orgs_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actorId_users_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_appId_apps_id_fk" FOREIGN KEY ("appId") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "env_vars" ADD CONSTRAINT "env_vars_orgId_orgs_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "env_vars" ADD CONSTRAINT "env_vars_appId_apps_id_fk" FOREIGN KEY ("appId") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_events" ADD CONSTRAINT "node_events_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_events" ADD CONSTRAINT "node_events_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_stats" ADD CONSTRAINT "node_stats_serverId_servers_id_fk" FOREIGN KEY ("serverId") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_orgId_orgs_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registered_nodes" ADD CONSTRAINT "registered_nodes_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_tokens" ADD CONSTRAINT "registration_tokens_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servers" ADD CONSTRAINT "servers_orgId_orgs_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "apps_org_idx" ON "apps" USING btree ("orgId");--> statement-breakpoint
CREATE INDEX "apps_server_idx" ON "apps" USING btree ("serverId");--> statement-breakpoint
CREATE INDEX "apps_org_status_idx" ON "apps" USING btree ("orgId","status");--> statement-breakpoint
CREATE INDEX "apps_org_name_idx" ON "apps" USING btree ("orgId","name");--> statement-breakpoint
CREATE INDEX "apps_org_created_idx" ON "apps" USING btree ("orgId","createdAt");--> statement-breakpoint
CREATE INDEX "audit_log_org_idx" ON "audit_log" USING btree ("orgId");--> statement-breakpoint
CREATE INDEX "audit_log_org_created_idx" ON "audit_log" USING btree ("orgId","createdAt");--> statement-breakpoint
CREATE INDEX "audit_log_org_action_idx" ON "audit_log" USING btree ("orgId","action");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actorId");--> statement-breakpoint
CREATE INDEX "audit_log_resource_idx" ON "audit_log" USING btree ("resource","resourceId","createdAt");--> statement-breakpoint
CREATE INDEX "deployments_app_idx" ON "deployments" USING btree ("appId");--> statement-breakpoint
CREATE INDEX "deployments_app_status_idx" ON "deployments" USING btree ("appId","status");--> statement-breakpoint
CREATE INDEX "deployments_app_created_idx" ON "deployments" USING btree ("appId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "deployments_app_version_idx" ON "deployments" USING btree ("appId","version");--> statement-breakpoint
CREATE UNIQUE INDEX "env_vars_app_key_idx" ON "env_vars" USING btree ("appId","key");--> statement-breakpoint
CREATE INDEX "env_vars_org_idx" ON "env_vars" USING btree ("orgId");--> statement-breakpoint
CREATE INDEX "node_events_server_idx" ON "node_events" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "node_events_type_idx" ON "node_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "node_events_received_idx" ON "node_events" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "node_events_server_type_idx" ON "node_events" USING btree ("server_id","event_type");--> statement-breakpoint
CREATE INDEX "node_events_server_received_idx" ON "node_events" USING btree ("server_id","received_at");--> statement-breakpoint
CREATE INDEX "node_stats_server_idx" ON "node_stats" USING btree ("serverId");--> statement-breakpoint
CREATE INDEX "node_stats_received_idx" ON "node_stats" USING btree ("receivedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_org_idx" ON "memberships" USING btree ("userId","orgId");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "memberships_org_idx" ON "memberships" USING btree ("orgId");--> statement-breakpoint
CREATE INDEX "orgs_name_idx" ON "orgs" USING btree ("name");--> statement-breakpoint
CREATE INDEX "orgs_created_idx" ON "orgs" USING btree ("createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "registered_nodes_server_idx" ON "registered_nodes" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "registered_nodes_status_idx" ON "registered_nodes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "registration_tokens_hash_idx" ON "registration_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "registration_tokens_expires_idx" ON "registration_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "servers_org_idx" ON "servers" USING btree ("orgId");--> statement-breakpoint
CREATE INDEX "servers_org_status_idx" ON "servers" USING btree ("orgId","status");--> statement-breakpoint
CREATE INDEX "servers_org_name_idx" ON "servers" USING btree ("orgId","name");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");