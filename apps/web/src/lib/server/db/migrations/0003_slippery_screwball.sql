ALTER TABLE "git_connections" ADD COLUMN "orgId" text NOT NULL;--> statement-breakpoint
ALTER TABLE "git_connections" ADD CONSTRAINT "git_connections_orgId_orgs_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "git_connections_org_idx" ON "git_connections" USING btree ("orgId");