import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryRepository,
  FakeNodeCommandClient,
  TEST_ORG_ID,
} from "./test-utils";
import { createReapWarmColors } from "./reap-warm-colors";

const NOW = "2025-01-01T00:00:00.000Z";

async function seedSource(
  repo: InMemoryRepository,
  appId: string,
  serverId: string,
) {
  await repo.apps.create(TEST_ORG_ID, {
    id: appId,
    name: appId,
    kind: "stateless",
    serverId,
    status: "healthy",
    activeColor: "green",
    createdAt: NOW,
    updatedAt: NOW,
  });
  await repo.gitSources.upsert({
    appId,
    connectionId: "conn-1",
    provider: "github",
    repoSlug: "octocat/hello",
    cloneUrl: "https://github.com/octocat/hello.git",
    branch: "main",
  });
}

describe("reapWarmColors", () => {
  let repo: InMemoryRepository;
  let nodeClient: FakeNodeCommandClient;

  beforeEach(() => {
    repo = new InMemoryRepository();
    nodeClient = new FakeNodeCommandClient();
  });

  it("stops and clears expired warm colors", async () => {
    await seedSource(repo, "app-1", "srv-1");
    await seedSource(repo, "app-2", "srv-2");
    await repo.gitSources.setWarmColor(
      "app-1",
      "blue",
      "2024-12-31T00:00:00.000Z",
    );
    await repo.gitSources.setWarmColor(
      "app-2",
      "blue",
      "2025-01-02T00:00:00.000Z",
    );

    const reaped = await createReapWarmColors(repo, nodeClient)(new Date(NOW));

    expect(reaped).toBe(1);
    expect(nodeClient.stoppedColor).toEqual([
      { serverId: "srv-1", appId: "app-1", color: "blue" },
    ]);
    expect((await repo.gitSources.findByApp("app-1"))?.warmColor).toBeNull();
    expect((await repo.gitSources.findByApp("app-2"))?.warmColor).toBe("blue");
  });

  it("continues past a failing node", async () => {
    await seedSource(repo, "app-1", "srv-1");
    await seedSource(repo, "app-2", "srv-2");
    await repo.gitSources.setWarmColor(
      "app-1",
      "blue",
      "2024-12-31T00:00:00.000Z",
    );
    await repo.gitSources.setWarmColor(
      "app-2",
      "green",
      "2024-12-31T00:00:00.000Z",
    );
    nodeClient.stopColorError = new Error("ssh down");

    const reaped = await createReapWarmColors(repo, nodeClient)(new Date(NOW));

    expect(reaped).toBe(0);
    expect((await repo.gitSources.findByApp("app-1"))?.warmColor).toBe("blue");
    expect((await repo.gitSources.findByApp("app-2"))?.warmColor).toBe("green");
  });
});
