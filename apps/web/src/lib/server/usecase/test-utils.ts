import type { AppSpec } from "../domain/app-spec";
import type { App } from "../domain/app";
import type { Server } from "../domain/server";
import type { User } from "../domain/user";
import type { Deployment } from "../domain/deployment";
import type {
  Repository,
  ServerRepository,
  ServerWithOrg,
  AppRepository,
  DeploymentRepository,
  UserRepository,
  SessionRepository,
  SystemSetupRepository,
  OrgRepository,
  OrgMembershipRepository,
  RegisteredNodeRepository,
  RegistrationTokenRepository,
} from "../ports/repository";
import type { Session } from "../domain/session";
import type { Org } from "../domain/org";
import type { OrgMembership } from "../domain/org-membership";
import type {
  NodeCommandClient as NodeCommandClientType,
  LogEntry as NodeCommandLogEntry,
  ContainerState,
} from "../ports/node-command-client";
import type { NodeEvent, NodeStats } from "../domain/node-event";
import type { NodeEventRepository } from "../ports/repository";
import type { RegisteredNode } from "../domain/registered-node";
import type { RegistrationToken } from "../domain/registration-token";

export const TEST_ORG_ID = "org-test";
export const TEST_USER_ID = "user-test";

// ── In-memory repository implementations ──────────────────────────────────

export class InMemoryServerRepo implements ServerRepository {
  private data = new Map<string, Map<string, Server>>();

  private orgMap(orgId: string) {
    let m = this.data.get(orgId);
    if (!m) {
      m = new Map();
      this.data.set(orgId, m);
    }
    return m;
  }

  async create(
    orgId: string,
    input: Server & { orgId?: string },
  ): Promise<Server> {
    const store = this.orgMap(orgId);
    const server: Server = {
      id: input.id,
      name: input.name,
      address: input.address ?? "",
      sshPort: input.sshPort ?? 22,
      sshUser: input.sshUser ?? "root",
      sshPrivateKey: input.sshPrivateKey ?? "",
      status: input.status,
      cpuCores: input.cpuCores ?? 0,
      memoryBytes: input.memoryBytes,
      diskBytes: input.diskBytes,
      labels: input.labels ?? {},
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      lastHeartbeatAt: input.lastHeartbeatAt,
    };
    store.set(server.id, server);
    return server;
  }

  async get(orgId: string, id: string): Promise<Server | null> {
    return this.orgMap(orgId).get(id) ?? null;
  }

  async getByIdAny(id: string): Promise<ServerWithOrg | null> {
    for (const [orgId, store] of this.data) {
      const s = store.get(id);
      if (s) return { ...s, orgId };
    }
    return null;
  }

  async list(orgId: string): Promise<Server[]> {
    return Array.from(this.orgMap(orgId).values());
  }

  async updateStatus(orgId: string, id: string, status: string): Promise<void> {
    const s = this.orgMap(orgId).get(id);
    if (s) {
      s.status = status as Server["status"];
      s.updatedAt = new Date().toISOString();
    }
  }

  async updateHeartbeat(orgId: string, id: string): Promise<void> {
    const s = this.orgMap(orgId).get(id);
    if (s) {
      s.lastHeartbeatAt = new Date().toISOString();
      s.status = "online";
      s.updatedAt = new Date().toISOString();
    }
  }
}

export class InMemoryAppRepo implements AppRepository {
  private data = new Map<string, Map<string, App>>();
  private orgMap(orgId: string) {
    let m = this.data.get(orgId);
    if (!m) {
      m = new Map();
      this.data.set(orgId, m);
    }
    return m;
  }

  async create(orgId: string, app: App): Promise<App> {
    const store = this.orgMap(orgId);
    store.set(app.id, { ...app });
    return app;
  }

  async get(orgId: string, id: string): Promise<App | null> {
    return this.orgMap(orgId).get(id) ?? null;
  }

  async list(orgId: string): Promise<App[]> {
    return Array.from(this.orgMap(orgId).values());
  }

  async updateStatus(orgId: string, id: string, status: string): Promise<void> {
    const a = this.orgMap(orgId).get(id);
    if (a) {
      a.status = status as App["status"];
      a.updatedAt = new Date().toISOString();
    }
  }

  async delete(orgId: string, id: string): Promise<void> {
    this.orgMap(orgId).delete(id);
  }
}

export class InMemoryDeploymentRepo implements DeploymentRepository {
  private data = new Map<string, Map<string, Deployment>>();
  private appRepo: InMemoryAppRepo;
  constructor(appRepo: InMemoryAppRepo) {
    this.appRepo = appRepo;
  }

  private orgMap(orgId: string) {
    let m = this.data.get(orgId);
    if (!m) {
      m = new Map();
      this.data.set(orgId, m);
    }
    return m;
  }

  async create(orgId: string, dep: Deployment): Promise<Deployment> {
    const store = this.orgMap(orgId);
    store.set(dep.id, { ...dep });
    return dep;
  }

  async listForApp(orgId: string, appId: string): Promise<Deployment[]> {
    return Array.from(this.orgMap(orgId).values()).filter(
      (d) => d.appId === appId,
    );
  }

  async getLatest(orgId: string, appId: string): Promise<Deployment | null> {
    const deps = await this.listForApp(orgId, appId);
    if (deps.length === 0) return null;
    return deps.reduce((latest, d) =>
      d.createdAt > latest.createdAt ? d : latest,
    );
  }

  async updateStatus(orgId: string, id: string, status: string): Promise<void> {
    const d = this.orgMap(orgId).get(id);
    if (d) {
      d.status = status as Deployment["status"];
      d.updatedAt = new Date().toISOString();
    }
  }
}

export class InMemoryUserRepo implements UserRepository {
  private data = new Map<string, Map<string, User>>();
  private orgMap(orgId: string) {
    let m = this.data.get(orgId);
    if (!m) {
      m = new Map();
      this.data.set(orgId, m);
    }
    return m;
  }
  async create(
    _db: unknown,
    orgId: string,
    user: User,
    _pw?: string,
  ): Promise<User> {
    const store = this.orgMap(orgId);
    store.set(user.id, user);
    return user;
  }
  async get(orgId: string, id: string): Promise<User | null> {
    return this.orgMap(orgId).get(id) ?? null;
  }
  async getByEmail(orgId: string, email: string): Promise<User | null> {
    for (const u of this.orgMap(orgId).values()) {
      if (u.email === email) return u;
    }
    return null;
  }
  async getPasswordHashByEmail(
    _email: string,
  ): Promise<{ user: User; passwordHash: string } | null> {
    return null;
  }
}

export class InMemorySessionRepo implements SessionRepository {
  private data = new Map<string, Session>();
  async create(_db: unknown, session: Session): Promise<Session> {
    this.data.set(session.id, session);
    return session;
  }
  async get(id: string): Promise<Session | null> {
    return this.data.get(id) ?? null;
  }
  async delete(id: string): Promise<void> {
    this.data.delete(id);
  }
  async deleteAllForUser(_userId: string): Promise<void> {}
}

export class InMemorySystemSetupRepo implements SystemSetupRepository {
  private configured = false;
  async isConfigured(): Promise<boolean> {
    return this.configured;
  }
  async tryAcquire(_db: unknown): Promise<boolean> {
    if (this.configured) return false;
    this.configured = true;
    return true;
  }
}

export class InMemoryOrgRepo implements OrgRepository {
  private data = new Map<string, Org>();
  async create(_db: unknown, org: Org): Promise<Org> {
    this.data.set(org.id, org);
    return org;
  }
}

export class InMemoryMembershipRepo implements OrgMembershipRepository {
  private data = new Map<string, OrgMembership>();
  async create(_db: unknown, m: OrgMembership): Promise<OrgMembership> {
    this.data.set(m.userId, m);
    return m;
  }
  async findByUserId(userId: string): Promise<OrgMembership | null> {
    return this.data.get(userId) ?? null;
  }
}

export class InMemoryNodeEventRepo implements NodeEventRepository {
  events: NodeEvent[] = [];
  stats: NodeStats[] = [];

  async insertEvent(
    serverId: string,
    eventType: string,
    payload: Record<string, unknown>,
    appId?: string,
  ): Promise<NodeEvent> {
    const ev: NodeEvent = {
      id: crypto.randomUUID(),
      serverId,
      appId,
      eventType: eventType as NodeEvent["eventType"],
      payload,
      receivedAt: new Date().toISOString(),
    };
    this.events.push(ev);
    return ev;
  }

  async insertStats(
    serverId: string,
    s: Omit<NodeStats, "id" | "receivedAt">,
  ): Promise<NodeStats> {
    const st: NodeStats = {
      id: crypto.randomUUID(),
      ...s,
      receivedAt: new Date().toISOString(),
    };
    this.stats.push(st);
    return st;
  }

  async getRecentEvents(
    serverId: string,
    limit = 100,
    _since?: string,
  ): Promise<NodeEvent[]> {
    return this.events.filter((e) => e.serverId === serverId).slice(0, limit);
  }

  async getLatestStats(serverId: string): Promise<NodeStats | null> {
    return this.stats.find((s) => s.serverId === serverId) ?? null;
  }

  async pruneEvents(_olderThan: string): Promise<void> {}
}

export class InMemoryRegisteredNodeRepo implements RegisteredNodeRepository {
  data = new Map<string, RegisteredNode>();

  async create(
    input: Parameters<RegisteredNodeRepository["create"]>[0],
  ): Promise<RegisteredNode> {
    const node: RegisteredNode = {
      id: input.id,
      serverId: input.serverId,
      sshPublicKey: input.sshPublicKey,
      monitorBearerToken: input.monitorBearerToken,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.set(input.serverId, node);
    return node;
  }

  async getByServer(serverId: string): Promise<RegisteredNode | null> {
    return this.data.get(serverId) ?? null;
  }

  async updateStatus(serverId: string, status: string): Promise<void> {
    const node = this.data.get(serverId);
    if (node) {
      node.status = status as RegisteredNode["status"];
      node.updatedAt = new Date().toISOString();
    }
  }

  async delete(serverId: string): Promise<void> {
    this.data.delete(serverId);
  }
}

export class InMemoryRegistrationTokenRepo implements RegistrationTokenRepository {
  data = new Map<string, RegistrationToken>();

  async create(
    input: Parameters<RegistrationTokenRepository["create"]>[0],
  ): Promise<RegistrationToken> {
    const token: RegistrationToken = {
      id: input.id,
      tokenHash: input.tokenHash,
      serverId: null,
      expiresAt: input.expiresAt,
      usedAt: null,
      createdAt: new Date().toISOString(),
    };
    this.data.set(token.id, token);
    return token;
  }

  async findByHash(tokenHash: string): Promise<RegistrationToken | null> {
    for (const token of this.data.values()) {
      if (
        token.tokenHash === tokenHash &&
        !token.usedAt &&
        new Date(token.expiresAt) > new Date()
      ) {
        return token;
      }
    }
    return null;
  }

  async markUsed(id: string, serverId: string): Promise<void> {
    const token = this.data.get(id);
    if (token) {
      token.serverId = serverId;
      token.usedAt = new Date().toISOString();
    }
  }

  async pruneExpired(): Promise<void> {
    const now = new Date();
    for (const [id, token] of this.data) {
      if (new Date(token.expiresAt) < now) {
        this.data.delete(id);
      }
    }
  }
}

export class InMemoryRepository implements Repository {
  apps: InMemoryAppRepo;
  servers: InMemoryServerRepo;
  deployments: InMemoryDeploymentRepo;
  users: InMemoryUserRepo;
  sessions: InMemorySessionRepo;
  systemSetup: InMemorySystemSetupRepo;
  orgs: InMemoryOrgRepo;
  memberships: InMemoryMembershipRepo;
  nodeEvents: InMemoryNodeEventRepo;
  registeredNodes: InMemoryRegisteredNodeRepo;
  registrationTokens: InMemoryRegistrationTokenRepo;

  constructor() {
    this.apps = new InMemoryAppRepo();
    this.servers = new InMemoryServerRepo();
    this.deployments = new InMemoryDeploymentRepo(this.apps);
    this.users = new InMemoryUserRepo();
    this.sessions = new InMemorySessionRepo();
    this.systemSetup = new InMemorySystemSetupRepo();
    this.orgs = new InMemoryOrgRepo();
    this.memberships = new InMemoryMembershipRepo();
    this.nodeEvents = new InMemoryNodeEventRepo();
    this.registeredNodes = new InMemoryRegisteredNodeRepo();
    this.registrationTokens = new InMemoryRegistrationTokenRepo();
  }
}

export class FakeNodeCommandClient implements NodeCommandClientType {
  deployLogs: NodeCommandLogEntry[] = [];
  deployed: Array<{ serverId: string; appId: string; composeYaml: string }> =
    [];
  containerStates: ContainerState[] = [];
  deployError?: Error;

  async *deploy(
    serverId: string,
    appId: string,
    composeYaml: string,
  ): AsyncIterable<NodeCommandLogEntry> {
    if (this.deployError) throw this.deployError;
    this.deployed.push({ serverId, appId, composeYaml });
    for (const entry of this.deployLogs) {
      yield entry;
    }
  }

  async restart(_serverId: string, _appId: string): Promise<void> {}
  async stop(_serverId: string, _appId: string): Promise<void> {}
  async remove(
    _serverId: string,
    _appId: string,
    _volumes: boolean,
  ): Promise<void> {}

  async status(_serverId: string, _appId: string): Promise<ContainerState[]> {
    return this.containerStates;
  }

  async logs(
    _serverId: string,
    _appId: string,
    _lines: number,
  ): Promise<NodeCommandLogEntry[]> {
    return this.deployLogs;
  }

  async isReachable(_serverId: string): Promise<boolean> {
    return true;
  }
}

export function validAppSpec(overrides?: Partial<AppSpec>): AppSpec {
  return {
    name: "test-app",
    image: "nginx:alpine",
    envVars: {},
    ports: [],
    volumeMounts: [],
    ...overrides,
  };
}
