import { describe, it, expect } from "vitest";
import {
  InMemoryRepository,
  FakeNodeCommandClient,
  validAppSpec,
  TEST_ORG_ID,
} from "./test-utils";
import { createDeployApp } from "./deploy-app";

describe("deployApp", () => {
  it("creates an app and deployment with healthy status", async () => {
    const repo = new InMemoryRepository();
    const nodeClient = new FakeNodeCommandClient();
    const deployApp = createDeployApp(repo, nodeClient);

    const serverId = "server-1";
    const spec = validAppSpec();

    const result = await deployApp(TEST_ORG_ID, spec, serverId);

    expect(result.app.name).toBe("test-app");
    expect(result.app.serverId).toBe(serverId);
    expect(result.app.status).toBe("healthy");
    expect(result.deployment.status).toBe("healthy");
    expect(result.deployment.version).toBe(1);
  });

  it("calls the node client to deploy with generated compose YAML", async () => {
    const repo = new InMemoryRepository();
    const nodeClient = new FakeNodeCommandClient();
    const deployApp = createDeployApp(repo, nodeClient);

    const serverId = "server-2";
    const spec = validAppSpec({ name: "nginx-app" });
    const result = await deployApp(TEST_ORG_ID, spec, serverId);

    expect(nodeClient.deployed).toHaveLength(1);
    expect(nodeClient.deployed[0].serverId).toBe(serverId);
    expect(nodeClient.deployed[0].appId).toBe(result.app.id);
    expect(nodeClient.deployed[0].composeYaml).toContain("nginx:alpine");
  });

  it("persists app and deployment in the repository", async () => {
    const repo = new InMemoryRepository();
    const nodeClient = new FakeNodeCommandClient();
    const deployApp = createDeployApp(repo, nodeClient);

    const serverId = "server-3";
    const spec = validAppSpec({ name: "persisted-app" });
    const result = await deployApp(TEST_ORG_ID, spec, serverId);

    const storedApp = await repo.apps.get(TEST_ORG_ID, result.app.id);
    expect(storedApp).not.toBeNull();
    expect(storedApp!.name).toBe("persisted-app");

    const storedDeployments = await repo.deployments.listForApp(
      TEST_ORG_ID,
      result.app.id,
    );
    expect(storedDeployments).toHaveLength(1);
  });

  it("marks deployment as failed on node client error", async () => {
    const repo = new InMemoryRepository();
    const nodeClient = new FakeNodeCommandClient();
    nodeClient.deployError = new Error("ssh connection failed");
    const deployApp = createDeployApp(repo, nodeClient);

    const serverId = "server-5";
    const spec = validAppSpec();

    await expect(deployApp(TEST_ORG_ID, spec, serverId)).rejects.toThrow(
      "ssh connection failed",
    );

    const apps = await repo.apps.list(TEST_ORG_ID);
    expect(apps).toHaveLength(1);
    expect(apps[0].status).toBe("degraded");

    const deployments = await repo.deployments.listForApp(
      TEST_ORG_ID,
      apps[0].id,
    );
    expect(deployments).toHaveLength(1);
    expect(deployments[0].status).toBe("failed");
  });

  it("transitions deployment to executing state", async () => {
    const repo = new InMemoryRepository();
    const nodeClient = new FakeNodeCommandClient();
    const deployApp = createDeployApp(repo, nodeClient);

    const result = await deployApp(TEST_ORG_ID, validAppSpec(), "server-4");

    const initialDeployments = await repo.deployments.listForApp(
      TEST_ORG_ID,
      result.app.id,
    );
    const dep = initialDeployments[0];
    expect(dep.id).toBe(result.deployment.id);
    expect(dep.status).toBe("healthy");
  });

  describe("stateless blue/green", () => {
    it("first deploy targets blue, sets activeColor, skips drain", async () => {
      const repo = new InMemoryRepository();
      const nodeClient = new FakeNodeCommandClient();
      const deployApp = createDeployApp(repo, nodeClient);

      const result = await deployApp(
        TEST_ORG_ID,
        validAppSpec(),
        "server-bg-1",
      );

      expect(result.app.activeColor).toBe("blue");
      expect(nodeClient.deployedColor).toHaveLength(1);
      expect(nodeClient.deployedColor[0].color).toBe("blue");
      expect(nodeClient.stoppedColor).toHaveLength(0);
      expect(result.deployment.status).toBe("healthy");
    });

    it("fails and stops new color when healthcheck never passes", async () => {
      const repo = new InMemoryRepository();
      const nodeClient = new FakeNodeCommandClient();
      nodeClient.colorContainerStates = [
        {
          id: "c1",
          name: "test-app-blue",
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
      const deployApp = createDeployApp(repo, nodeClient, {
        verifyTimeoutMs: 100,
      });

      await expect(
        deployApp(TEST_ORG_ID, validAppSpec(), "server-bg-3"),
      ).rejects.toThrow("Health check timeout");

      const apps = await repo.apps.list(TEST_ORG_ID);
      expect(apps[0].status).toBe("degraded");
      expect(apps[0].activeColor).toBeNull();
      expect(nodeClient.stoppedColor).toHaveLength(1);
      expect(nodeClient.stoppedColor[0].color).toBe("blue");
    });

    it("observes FSM states through the deployment record", async () => {
      const repo = new InMemoryRepository();
      const nodeClient = new FakeNodeCommandClient();
      const deployApp = createDeployApp(repo, nodeClient);

      const result = await deployApp(
        TEST_ORG_ID,
        validAppSpec(),
        "server-bg-4",
      );
      const deps = await repo.deployments.listForApp(
        TEST_ORG_ID,
        result.app.id,
      );
      expect(deps).toHaveLength(1);
      expect(deps[0].status).toBe("healthy");
    });

    it("stateful apps use the recreate flow unchanged", async () => {
      const repo = new InMemoryRepository();
      const nodeClient = new FakeNodeCommandClient();
      const deployApp = createDeployApp(repo, nodeClient);

      const result = await deployApp(
        TEST_ORG_ID,
        validAppSpec({ kind: "stateful" }),
        "server-bg-5",
      );

      expect(result.app.status).toBe("healthy");
      expect(nodeClient.deployed).toHaveLength(1);
      expect(nodeClient.deployedColor).toHaveLength(0);
    });
  });

  describe("git-sourced apps", () => {
    const GIT_URL = "https://github.com/octocat/hello.git";

    function gitSpec(): ReturnType<typeof validAppSpec> {
      return validAppSpec({ image: undefined, buildContext: GIT_URL });
    }

    it("calls build before deploy for git-sourced apps", async () => {
      const repo = new InMemoryRepository();
      const nodeClient = new FakeNodeCommandClient();
      const deployApp = createDeployApp(repo, nodeClient);

      const result = await deployApp(TEST_ORG_ID, gitSpec(), "server-git-1");

      expect(nodeClient.built).toHaveLength(1);
      expect(nodeClient.built[0]).toMatchObject({
        serverId: "server-git-1",
        appId: result.app.id,
        gitUrl: GIT_URL,
        commit: undefined,
        cloneAuth: undefined,
      });
      expect(nodeClient.deployed).toHaveLength(1);
      expect(nodeClient.built[0].appId).toBe(nodeClient.deployed[0].appId);
    });

    it("passes resolved clone auth to build", async () => {
      const repo = new InMemoryRepository();
      const nodeClient = new FakeNodeCommandClient();
      const cloneAuth = {
        url: "https://x-access-token:ghs_secret@github.com/octocat/hello.git",
      };
      const deployApp = createDeployApp(repo, nodeClient, {
        resolveCloneAuth: async () => cloneAuth,
      });

      await deployApp(TEST_ORG_ID, gitSpec(), "server-git-2");

      expect(nodeClient.built[0].cloneAuth).toEqual(cloneAuth);
    });

    it("does not call build for image-based app specs", async () => {
      const repo = new InMemoryRepository();
      const nodeClient = new FakeNodeCommandClient();
      const deployApp = createDeployApp(repo, nodeClient);

      await deployApp(TEST_ORG_ID, validAppSpec(), "server-git-3");

      expect(nodeClient.built).toHaveLength(0);
      expect(nodeClient.deployed).toHaveLength(1);
    });

    it("marks deployment as failed on build error", async () => {
      const repo = new InMemoryRepository();
      const nodeClient = new FakeNodeCommandClient();
      nodeClient.buildError = new Error("git clone failed");
      const deployApp = createDeployApp(repo, nodeClient);

      await expect(
        deployApp(TEST_ORG_ID, gitSpec(), "server-git-4"),
      ).rejects.toThrow("git clone failed");

      const apps = await repo.apps.list(TEST_ORG_ID);
      expect(apps[0].status).toBe("degraded");
      const deployments = await repo.deployments.listForApp(
        TEST_ORG_ID,
        apps[0].id,
      );
      expect(deployments[0].status).toBe("failed");
      expect(nodeClient.deployed).toHaveLength(0);
    });
  });
});
