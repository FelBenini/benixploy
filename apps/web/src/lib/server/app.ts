import { sql } from "drizzle-orm";
import { db } from "$lib/server/db/client";
import type { DbExecutor } from "$lib/server/ports/repository";
import { DrizzleRepository } from "$lib/server/adapters/db/drizzle-repository";
import { SshNodeCommandClient } from "$lib/server/adapters/node-ssh";
import { encrypt, decrypt } from "$lib/server/adapters/encryption";
import { InMemoryRateLimiter } from "$lib/server/adapters/rate-limit/in-memory";
import { createRegisterServer } from "$lib/server/usecase/register-server";
import { createDeployApp } from "$lib/server/usecase/deploy-app";
import { createListApps } from "$lib/server/usecase/list-apps";
import { createGetApp } from "$lib/server/usecase/get-app";
import { createProvisionServer } from "$lib/server/usecase/provision-server";
import {
  createSession,
  validateSessionToken,
  deleteSession,
} from "$lib/server/auth/session";
import { hashPassword, verifyPassword } from "$lib/server/auth/password";
import { getGitProvider } from "$lib/server/adapters/git";
import { isHttpUrl } from "$lib/server/adapters/compose-gen";
import type { AppSpec } from "$lib/server/domain/app-spec";
import type { CloneAuth } from "$lib/server/ports/git-provider-client";

import { ENCRYPTION_KEY, REDIS_URL } from "$app/env/private";
import { dev } from "$app/environment";
import { createOAuthStateStore } from "$lib/server/adapters/oauth-state";
import { RedisJobQueue } from "$lib/server/adapters/queue/redis-job-queue";
import { createStubDeployJobHandler } from "$lib/server/usecase/deploy-job-handler";
import { Redis } from "ioredis";

const hasEncryption = ENCRYPTION_KEY != null && ENCRYPTION_KEY.length > 0;
const encryptKey = hasEncryption
  ? (s: string) => encrypt(s, ENCRYPTION_KEY as string)
  : undefined;
const decryptKey = hasEncryption
  ? (s: string) => decrypt(s, ENCRYPTION_KEY as string)
  : undefined;
const repo = new DrizzleRepository(db, encryptKey, decryptKey);

const isRedisConfigured = REDIS_URL != null && REDIS_URL.length > 0;
const redis = isRedisConfigured
  ? new Redis(REDIS_URL as string, {
      lazyConnect: true,
      connectTimeout: 5_000,
      maxRetriesPerRequest: 1,
    })
  : null;
redis?.on("error", (err) => {
  console.error("redis error:", err.message);
});

const oauthStates = createOAuthStateStore(redis, dev);

const jobQueue = redis ? new RedisJobQueue(redis) : null;
jobQueue?.start(createStubDeployJobHandler(repo.pushEvents));
if (jobQueue) {
  const stopQueue = () => {
    void jobQueue.stop();
  };
  process.on("SIGTERM", stopQueue);
  process.on("SIGINT", stopQueue);
}

const nodeSshClient = new SshNodeCommandClient(async (serverId: string) => {
  const server = await repo.servers.getByIdAny(serverId);
  return server ?? null;
});

// Derived from a clone URL, e.g. "https://github.com/octocat/hello.git"
// -> "octocat/hello".
function repoSlugFromUrl(url: string): string | null {
  try {
    const parts = new URL(url).pathname
      .replace(/\.git$/, "")
      .split("/")
      .filter(Boolean);
    if (parts.length < 2) return null;
    return parts.slice(-2).join("/");
  } catch {
    return null;
  }
}

// Best-effort clone-auth resolution for git-sourced deploys: match the
// build-context URL's host against the org's provider connections, then ask
// that provider's adapter for credentials. Returns undefined when no
// connection matches (the repo is presumably public — the node will fail
// loudly on clone if not). Resolution errors for a *matching* connection
// propagate: a broken connection shouldn't silently fall back to public.
async function resolveCloneAuth(
  orgId: string,
  appSpec: AppSpec,
): Promise<CloneAuth | undefined> {
  const buildContext = appSpec.buildContext;
  if (!buildContext || !isHttpUrl(buildContext)) return undefined;

  const target = new URL(buildContext);
  const slug = repoSlugFromUrl(buildContext);
  if (!slug) return undefined;

  const connections = await repo.gitConnections.listGitConnections(orgId);
  for (const connection of connections) {
    const hostMatches =
      connection.provider === "github"
        ? target.host === "github.com" || target.host.endsWith(".github.com")
        : (() => {
            try {
              return new URL(connection.baseUrl).host === target.host;
            } catch {
              return false;
            }
          })();
    if (!hostMatches) continue;

    const fullConnection = await repo.gitConnections.findGitConnection(
      orgId,
      connection.id,
    );
    if (!fullConnection) continue;

    return getGitProvider(connection.provider).resolveCloneAuth(
      fullConnection,
      slug,
    );
  }
  return undefined;
}

const loginIpLimiter = new InMemoryRateLimiter(20, 15 * 60 * 1000);
const loginAccountLimiter = new InMemoryRateLimiter(5, 15 * 60 * 1000);

const rateLimiterSweepInterval = setInterval(
  () => {
    loginIpLimiter.sweep();
    loginAccountLimiter.sweep();
  },
  5 * 60 * 1000,
);
(rateLimiterSweepInterval as { unref?: () => void }).unref?.();

// Stale-server sweep: every 30s, flip servers to offline if no heartbeat
// in >3× the default node-agent heartbeat interval (i.e. >30s).
const staleSweepInterval = setInterval(async () => {
  try {
    const cutoff = new Date(Date.now() - 35_000).toISOString();
    await db.execute(
      sql`UPDATE servers SET status = 'offline', "updatedAt" = NOW()
          WHERE status = 'online' AND "lastHeartbeatAt" IS NOT NULL AND "lastHeartbeatAt" < ${cutoff}::timestamptz`,
    );
  } catch (err) {
    console.error("stale-server sweep failed:", err);
  }
}, 30_000);
(staleSweepInterval as { unref?: () => void }).unref?.();

// Retention cleanup: prune node_events older than 24h every hour
const retentionInterval = setInterval(async () => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await repo.nodeEvents.pruneEvents(cutoff);
  } catch (err) {
    console.error("node_events retention sweep failed:", err);
  }
}, 3600_000);
(retentionInterval as { unref?: () => void }).unref?.();

export const app = {
  db,
  redis,
  repo,
  oauthStates,
  jobQueue,
  nodeSshClient,
  adapters: {
    sshNodeCommand: nodeSshClient,
  },
  useCases: {
    registerServer: createRegisterServer(repo),
    provisionServer: createProvisionServer(repo),
    deployApp: createDeployApp(repo, nodeSshClient, { resolveCloneAuth }),
    listApps: createListApps(repo),
    getApp: createGetApp(repo),
  },
  auth: {
    createSession: (executor: DbExecutor, userId: string) =>
      createSession(executor, repo.sessions, userId),
    validateSessionToken: (token: string) =>
      validateSessionToken(repo.sessions, token),
    deleteSession: (sessionId: string) =>
      deleteSession(repo.sessions, sessionId),
    hashPassword,
    verifyPassword,
  },
  systemSetup: repo.systemSetup,
  rateLimiters: {
    loginByIp: loginIpLimiter,
    loginByAccount: loginAccountLimiter,
  },
};
