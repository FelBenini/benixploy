import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Repository } from "../../ports/repository";
import type { FieldTransform } from "./servers";
import * as schema from "../../db/schema";
import { DrizzleServerRepository } from "./servers";
import { DrizzleAppRepository } from "./apps";
import { DrizzleDeploymentRepository } from "./deployments";
import { DrizzleUserRepository } from "./users";
import { DrizzleSessionRepository } from "./sessions";
import { DrizzleSystemSetupRepository } from "./system-setup";
import { DrizzleOrgRepository } from "./orgs";
import { DrizzleOrgMembershipRepository } from "./org-memberships";
import { DrizzleNodeEventRepository } from "./node-events";
import { DrizzleRegisteredNodeRepository } from "./registered-nodes";
import { DrizzleRegistrationTokenRepository } from "./registration-tokens";

export type DrizzleDB = NodePgDatabase<typeof schema>;

export class DrizzleRepository implements Repository {
  servers: DrizzleServerRepository;
  apps: DrizzleAppRepository;
  deployments: DrizzleDeploymentRepository;
  users: DrizzleUserRepository;
  sessions: DrizzleSessionRepository;
  systemSetup: DrizzleSystemSetupRepository;
  orgs: DrizzleOrgRepository;
  memberships: DrizzleOrgMembershipRepository;
  nodeEvents: DrizzleNodeEventRepository;
  registeredNodes: DrizzleRegisteredNodeRepository;
  registrationTokens: DrizzleRegistrationTokenRepository;

  constructor(
    db: DrizzleDB,
    encryptPrivateKey?: FieldTransform,
    decryptPrivateKey?: FieldTransform,
  ) {
    this.servers = new DrizzleServerRepository(
      db,
      encryptPrivateKey,
      decryptPrivateKey,
    );
    this.apps = new DrizzleAppRepository(db);
    this.deployments = new DrizzleDeploymentRepository(db);
    this.users = new DrizzleUserRepository(db);
    this.sessions = new DrizzleSessionRepository(db);
    this.systemSetup = new DrizzleSystemSetupRepository(db);
    this.orgs = new DrizzleOrgRepository(db);
    this.memberships = new DrizzleOrgMembershipRepository(db);
    this.nodeEvents = new DrizzleNodeEventRepository(db);
    this.registeredNodes = new DrizzleRegisteredNodeRepository(db);
    this.registrationTokens = new DrizzleRegistrationTokenRepository(db);
  }
}
