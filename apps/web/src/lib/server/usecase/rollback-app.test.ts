import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryRepository,
  FakeNodeCommandClient,
  validAppSpec,
  TEST_ORG_ID,
} from "./test-utils";
import { createRollbackApp } from "./rollback-app";
import type { ActiveColor } from "../domain/git-source";
import type { AppKind } from "../domain/app-spec";

const NOW = "2025-01-01T00:00:00.000Z";

async function seedBlueGreenApp(
  repo: InMemoryRepository,
  overrides: { kind?: AppKind; activeColor?: ActiveColor | null } = {},
) {
  const app = await repo.apps.create(TEST_ORG_ID, {
    id: "app-1",
    name: "test-app",
    kind: overrides.kind ?? "stateless",
    serverId: "srv-1",
    status: "healthy",
    activeColor: overrides.activeColor ?? "green",
    createdAt: NOW,
    updatedAt: NOW,
  });

  await repo.deployments.create(TEST_ORG_ID, {
    id: "dep-1",
    appId: app.id,
    serverId: "srv-1",
    status: "healthy",
    appSpec: validAppSpec({ name: "test-app" }),
    composeYaml: "prior-compose",
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  });
  await repo.deployments.create(TEST_ORG_ID, {
    id: "dep-2",
    appId: app.id,
    serverId: "srv-1",
    status: "healthy",
    appSpec: validAppSpec({ name: "test-app" }),
    composeYaml: "current-compose",
    version: 2,
    createdAt: NOW,
    updatedAt: NOW,
  });

  await repo.gitSources.upsert({
    appId: app.id,
    connectionId: "conn-1",
    provider: "github",
    repoSlug: "octocat/hello",
    cloneUrl: "https://github.com/octocat/hello.git",
    branch: "main",
  });

  return app;
}

function warmExpiry(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

describe("rollbackApp", () => {
  let repo: InMemoryRepository;
  let nodeClient: FakeNodeCommandClient;

  beforeEach(() => {
    repo = new InMemoryRepository();
    nodeClient = new FakeNodeCommandClient();
  });

  it("instant blue/green flip when prior color is warm", async () => {
    const app = await seedBlueGreenApp(repo);
    await repo.gitSources.setWarmColor(app.id, "blue", warmExpiry(1));

    const result = await createRollbackApp(repo, nodeClient)(
      TEST_ORG_ID,
      app.id,
    );

    expect(result.strategy).toBe("blue_green_flip");
    expect(result.targetVersion).toBe(1);
    expect(result.app.activeColor).toBe("blue");
    expect(result.app.status).toBe("healthy");

    const source = await repo.gitSources.findByApp(app.id);
    expect(source?.activeColor).toBe("blue");
    expect(source?.warmColor).toBe("green");

    expect(nodeClient.deployed).toHaveLength(1);
    expect(nodeClient.deployed[0].composeYaml).toContain("nginx:alpine");
    expect(nodeClient.stoppedColor).toEqual([
      { serverId: "srv-1", appId: app.id, color: "green" },
    ]);

    const deps = await repo.deployments.listForApp(TEST_ORG_ID, app.id);
    expect(deps.find((d) => d.version === 2)?.status).toBe("rolled_back");

    const audit = repo.auditLogs.entries;
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe("rollback");
    expect(audit[0].resourceId).toBe(app.id);
    expect(audit[0].details).toMatchObject({ strategy: "blue_green_flip" });
  });

  it("classical rollback when warm window expired", async () => {
    const app = await seedBlueGreenApp(repo);
    await repo.gitSources.setWarmColor(app.id, "blue", warmExpiry(-1));

    const result = await createRollbackApp(repo, nodeClient)(
      TEST_ORG_ID,
      app.id,
    );

    expect(result.strategy).toBe("classical");
    expect(nodeClient.deployed[0].composeYaml).toBe("prior-compose");
    expect(nodeClient.stoppedColor).toHaveLength(0);
    expect((await repo.apps.get(TEST_ORG_ID, app.id))?.activeColor).toBe(
      "green",
    );
    expect((await repo.gitSources.findByApp(app.id))?.warmColor).toBeNull();
    expect(repo.auditLogs.entries[0].details).toMatchObject({
      strategy: "classical",
    });
  });

  it("falls back to classical for stateful apps even with a warm color", async () => {
    const app = await seedBlueGreenApp(repo, {
      kind: "stateful",
      activeColor: null,
    });
    await repo.gitSources.setWarmColor(app.id, "blue", warmExpiry(1));

    const result = await createRollbackApp(repo, nodeClient)(
      TEST_ORG_ID,
      app.id,
    );

    expect(result.strategy).toBe("classical");
    expect(nodeClient.deployed[0].composeYaml).toBe("prior-compose");
    expect(nodeClient.stoppedColor).toHaveLength(0);
  });

  it("throws when there is no prior deployment", async () => {
    const app = await repo.apps.create(TEST_ORG_ID, {
      id: "app-1",
      name: "test-app",
      kind: "stateless",
      serverId: "srv-1",
      status: "healthy",
      activeColor: "blue",
      createdAt: NOW,
      updatedAt: NOW,
    });
    await repo.deployments.create(TEST_ORG_ID, {
      id: "dep-1",
      appId: app.id,
      serverId: "srv-1",
      status: "healthy",
      appSpec: validAppSpec({ name: "test-app" }),
      composeYaml: "prior-compose",
      version: 1,
      createdAt: NOW,
      updatedAt: NOW,
    });

    await expect(
      createRollbackApp(repo, nodeClient)(TEST_ORG_ID, app.id),
    ).rejects.toThrow("No prior deployment");
  });

  it("marks the app degraded when the node deploy fails", async () => {
    const app = await seedBlueGreenApp(repo);
    await repo.gitSources.setWarmColor(app.id, "blue", warmExpiry(1));
    nodeClient.deployError = new Error("ssh connection failed");

    await expect(
      createRollbackApp(repo, nodeClient)(TEST_ORG_ID, app.id),
    ).rejects.toThrow("ssh connection failed");

    expect((await repo.apps.get(TEST_ORG_ID, app.id))?.status).toBe("degraded");
  });
});
