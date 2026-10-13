import { sql } from "drizzle-orm";
import { db } from "$lib/server/db/client";
import type { DbExecutor } from "$lib/server/ports/repository";
import { DrizzleRepository } from "$lib/server/adapters/db/drizzle-repository";
import { SshNodeCommandClient } from "$lib/server/adapters/node-ssh";
import { encrypt, decrypt } from "$lib/server/adapters/encryption";
import { createLoginRateLimiters } from "$lib/server/adapters/rate-limit";
import { createRegisterServer } from "$lib/server/usecase/register-server";
import { createDeployApp } from "$lib/server/usecase/deploy-app";
import { createRollbackApp } from "$lib/server/usecase/rollback-app";
import { createReapWarmColors } from "$lib/server/usecase/reap-warm-colors";
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
import { ScheduledJob } from "$lib/server/adapters/queue/scheduled-job";
import { createDeployJobHandler } from "$lib/server/usecase/deploy-job-handler";
import { createHandleWebhook } from "$lib/server/usecase/handle-webhook";
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

const nodeSshClient = new SshNodeCommandClient(async (serverId: string) => {
  const server = await repo.servers.getByIdAny(serverId);
  return server ?? null;
});

// Clone auth for push deploys: the job carries the connection, so no
// host-matching is needed (unlike manual deploys resolving from a build URL).
async function resolvePushCloneAuth(
  orgId: string,
  connectionId: string | null,
  repoSlug: string,
): Promise<CloneAuth | undefined> {
  if (!connectionId) return undefined;
  const connection = await repo.gitConnections.findGitConnection(
    orgId,
    connectionId,
  );
  if (!connection) return undefined;
  return getGitProvider(connection.provider).resolveCloneAuth(
    connection,
    repoSlug,
  );
}

const jobQueue = redis ? new RedisJobQueue(redis) : null;
jobQueue?.start(
  createDeployJobHandler(repo, nodeSshClient, {
    resolveCloneAuth: resolvePushCloneAuth,
  }),
);
if (jobQueue) {
  const stopQueue = () => {
    void jobQueue.stop();
  };
  process.on("SIGTERM", stopQueue);
  process.on("SIGINT", stopQueue);
}

const reapWarmColors = createReapWarmColors(repo, nodeSshClient);

// Recurring sweeps as repeatable BullMQ jobs (one tick runs across replicas):
// - warm-reap: stop drained colors past their 1h retention window
// - stale-server: flip servers to offline when no heartbeat in >30s
// - node-events-retention: prune node_events older than 24h
const scheduledJobs = redis
  ? [
      new ScheduledJob(
        "warm-reap",
        redis,
        async () => {
          await reapWarmColors();
        },
        5 * 60 * 1000,
      ),
      new ScheduledJob(
        "stale-server",
        redis,
        async () => {
          const cutoff = new Date(Date.now() - 35_000).toISOString();
          await db.execute(
            sql`UPDATE servers SET status = 'offline', "updatedAt" = NOW()
                WHERE status = 'online' AND "lastHeartbeatAt" IS NOT NULL AND "lastHeartbeatAt" < ${cutoff}::timestamptz`,
          );
        },
        30_000,
      ),
      new ScheduledJob(
        "node-events-retention",
        redis,
        async () => {
          const cutoff = new Date(
            Date.now() - 24 * 60 * 60 * 1000,
          ).toISOString();
          await repo.nodeEvents.pruneEvents(cutoff);
        },
        3600_000,
      ),
    ]
  : [];

for (const job of scheduledJobs) {
  job
    .start()
    .catch((err) => console.error(`${job.name} scheduler start failed:`, err));
}

const stopScheduledJobs = () => {
  for (const job of scheduledJobs) void job.stop();
};
process.on("SIGTERM", stopScheduledJobs);
process.on("SIGINT", stopScheduledJobs);

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

const { loginByIp, loginByAccount } = createLoginRateLimiters(redis);

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
    rollbackApp: createRollbackApp(repo, nodeSshClient),
    listApps: createListApps(repo),
    getApp: createGetApp(repo),
    handleWebhook: createHandleWebhook(repo, jobQueue, getGitProvider),
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
    loginByIp,
    loginByAccount,
  },
};
