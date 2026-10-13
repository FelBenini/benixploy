import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryRepository,
  FakeNodeCommandClient,
  validAppSpec,
  TEST_ORG_ID,
} from "./test-utils";
import { createDeployJobHandler } from "./deploy-job-handler";
import type { DeployJob } from "../ports/job-queue";
import type { ActiveColor } from "../domain/git-source";
import type { PushEvent } from "../domain/push-event";

const NOW = "2025-01-01T00:00:00.000Z";
const GIT_URL = "https://github.com/octocat/hello.git";
const SHA = "abc1234567890";

interface Seeded {
  appId: string;
  pushEvent: PushEvent;
  job: DeployJob;
}

async function seed(
  repo: InMemoryRepository,
  opts: {
    kind?: "stateless" | "stateful" | "database";
    activeColor?: ActiveColor | null;
    envVars?: Record<string, string>;
  } = {},
): Promise<Seeded> {
  const appId = "app-1";
  await repo.apps.create(TEST_ORG_ID, {
    id: appId,
    name: "test-app",
    kind: opts.kind ?? "stateless",
    serverId: "srv-1",
    status: "healthy",
    activeColor: opts.activeColor ?? null,
    createdAt: NOW,
    updatedAt: NOW,
  });

  await repo.deployments.create(TEST_ORG_ID, {
    id: "dep-1",
    appId,
    serverId: "srv-1",
    status: "healthy",
    appSpec: validAppSpec({
      name: "test-app",
      image: undefined,
      buildContext: GIT_URL,
      envVars: { BASE: "1" },
    }),
    composeYaml: "v1-compose",
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  });

  await repo.gitSources.upsert({
    appId,
    connectionId: "conn-1",
    provider: "github",
    repoSlug: "octocat/hello",
    cloneUrl: GIT_URL,
    branch: "main",
  });
  if (opts.activeColor) {
    await repo.gitSources.setActiveColor(appId, opts.activeColor);
  }
  if (opts.envVars) {
    repo.envVars.data.set(appId, opts.envVars);
  }

  const pushEvent = await repo.pushEvents.create({
    appId,
    connectionId: "conn-1",
    provider: "github",
    repoSlug: "octocat/hello",
    branch: "main",
    ref: "refs/heads/main",
    sha: SHA,
    message: "feat: thing",
    deliveryId: "deliv-1",
    status: "queued",
    deployJobId: null,
  });

  return {
    appId,
    pushEvent,
    job: {
      orgId: TEST_ORG_ID,
      appId,
      pushEventId: pushEvent.id,
      sha: SHA,
      repoSlug: "octocat/hello",
      branch: "main",
      cloneUrl: GIT_URL,
      connectionId: "conn-1",
    },
  };
}

function events(repo: InMemoryRepository, appId: string, type: string) {
  return repo.nodeEvents.events.filter(
    (e) => e.appId === appId && e.eventType === type,
  );
}

describe("createDeployJobHandler", () => {
  let repo: InMemoryRepository;
  let nodeClient: FakeNodeCommandClient;

  beforeEach(() => {
    repo = new InMemoryRepository();
    nodeClient = new FakeNodeCommandClient();
  });

  it("first push deploys blue, flips traffic, and records state", async () => {
    const { appId, job } = await seed(repo, { activeColor: null });

    await createDeployJobHandler(repo, nodeClient)(job);

    expect(nodeClient.built).toHaveLength(1);
    expect(nodeClient.built[0]).toMatchObject({
      appId,
      gitUrl: GIT_URL,
      commit: SHA,
    });
    expect(nodeClient.deployedColor).toHaveLength(1);
    expect(nodeClient.deployedColor[0].color).toBe("blue");

    expect(nodeClient.traefikWrites).toHaveLength(1);
    expect(nodeClient.traefikWrites[0].yaml).toContain("test-app-blue");
    expect(nodeClient.stoppedColor).toHaveLength(0);

    const app = await repo.apps.get(TEST_ORG_ID, appId);
    expect(app?.activeColor).toBe("blue");
    expect(app?.status).toBe("healthy");

    const source = await repo.gitSources.findByApp(appId);
    expect(source?.activeColor).toBe("blue");
    expect(source?.warmColor).toBeNull();
    expect(source?.shaDeployed).toBe(SHA);
    expect(source?.lastPushAt).not.toBeNull();

    const deps = await repo.deployments.listForApp(TEST_ORG_ID, appId);
    const latest = deps.find((d) => d.version === 2);
    expect(latest?.status).toBe("healthy");
    expect(latest?.color).toBe("blue");
    expect(latest?.composeYaml).toContain("benisploy/app-1:v2");

    expect((await repo.pushEvents.findByAppId(appId))[0].status).toBe(
      "success",
    );

    expect(repo.auditLogs.entries).toHaveLength(1);
    expect(repo.auditLogs.entries[0]).toMatchObject({
      action: "deploy",
      resourceId: appId,
    });
    expect(repo.auditLogs.entries[0].details).toMatchObject({
      strategy: "first_deploy",
      color: "blue",
    });

    expect(events(repo, appId, "deploy_started")).toHaveLength(1);
    expect(events(repo, appId, "deploy_done")).toHaveLength(1);
  });

  it("second push deploys green, flips, drains blue warm", async () => {
    const { appId, job } = await seed(repo, { activeColor: "blue" });

    await createDeployJobHandler(repo, nodeClient)(job);

    expect(nodeClient.deployedColor[0].color).toBe("green");
    expect(nodeClient.traefikWrites[0].yaml).toContain("test-app-green");
    expect(nodeClient.stoppedColor).toEqual([
      { serverId: "srv-1", appId, color: "blue" },
    ]);

    const app = await repo.apps.get(TEST_ORG_ID, appId);
    expect(app?.activeColor).toBe("green");

    const source = await repo.gitSources.findByApp(appId);
    expect(source?.activeColor).toBe("green");
    expect(source?.warmColor).toBe("blue");
    expect(new Date(source!.warmExpiresAt!).getTime()).toBeGreaterThan(
      Date.now(),
    );

    expect(repo.auditLogs.entries[0].details).toMatchObject({
      strategy: "blue_green_flip",
      warm: "blue",
    });
  });

  it("merges live env vars over the deployment snapshot", async () => {
    const { job } = await seed(repo, {
      activeColor: "blue",
      envVars: { DATABASE_URL: "postgres://live" },
    });

    await createDeployJobHandler(repo, nodeClient)(job);

    const yaml = nodeClient.built[0].composeYaml;
    expect(yaml).toContain("BASE");
    expect(yaml).toContain("postgres://live");
  });

  it("build failure leaves the live color untouched", async () => {
    const { appId, job } = await seed(repo, { activeColor: "blue" });
    nodeClient.buildError = new Error("git clone failed");

    await createDeployJobHandler(repo, nodeClient)(job);

    expect(nodeClient.deployedColor).toHaveLength(0);
    expect(nodeClient.traefikWrites).toHaveLength(0);
    expect(nodeClient.stoppedColor).toHaveLength(0);

    const app = await repo.apps.get(TEST_ORG_ID, appId);
    expect(app?.activeColor).toBe("blue");
    expect(app?.status).toBe("degraded");

    expect((await repo.pushEvents.findByAppId(appId))[0].status).toBe("failed");
    const failed = events(repo, appId, "build_failed");
    expect(failed).toHaveLength(1);
    expect(failed[0].payload).toMatchObject({
      sha: SHA,
      reason: "git clone failed",
    });

    const deps = await repo.deployments.listForApp(TEST_ORG_ID, appId);
    expect(deps).toHaveLength(1);
  });

  it("healthcheck timeout stops the new color and keeps the old one live", async () => {
    const { appId, job } = await seed(repo, { activeColor: "blue" });
    nodeClient.colorContainerStates = [
      {
        id: "c1",
        name: "test-app-green",
        image: "",
        project: "",
        service: "",
        created: "",
        state: "running",
        status: "",
        ports: "",
        health: "unhealthy",
      },
    ];

    await createDeployJobHandler(repo, nodeClient, {
      verifyTimeoutMs: 100,
    })(job);

    expect(nodeClient.stoppedColor).toEqual([
      { serverId: "srv-1", appId, color: "green" },
    ]);
    expect(nodeClient.traefikWrites).toHaveLength(0);

    const app = await repo.apps.get(TEST_ORG_ID, appId);
    expect(app?.activeColor).toBe("blue");
    expect(app?.status).toBe("degraded");

    const failed = events(repo, appId, "deploy_failed");
    expect(failed).toHaveLength(1);
    expect(String(failed[0].payload.reason)).toContain("healthcheck_timeout");
  });

  it("rejects stateful apps without touching the node", async () => {
    const { appId, job } = await seed(repo, { kind: "stateful" });

    await createDeployJobHandler(repo, nodeClient)(job);

    expect(nodeClient.built).toHaveLength(0);
    expect((await repo.pushEvents.findByAppId(appId))[0].status).toBe("failed");
  });

  it("marks the push failed when the app does not exist", async () => {
    const { pushEvent, job } = await seed(repo);
    await repo.apps.delete(TEST_ORG_ID, job.appId);

    await createDeployJobHandler(
      repo,
      nodeClient,
    )({
      ...job,
      pushEventId: pushEvent.id,
    });

    const stored = repo.pushEvents.data.get(pushEvent.id);
    expect(stored?.status).toBe("failed");
    expect(nodeClient.built).toHaveLength(0);
  });
});
