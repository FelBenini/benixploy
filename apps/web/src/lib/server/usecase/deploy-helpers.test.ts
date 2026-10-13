import { describe, it, expect } from "vitest";
import { FakeNodeCommandClient } from "./test-utils";
import { waitForHealthy } from "./deploy-helpers";
import type { ContainerState } from "../ports/node-command-client";

function state(overrides: Partial<ContainerState>): ContainerState {
  return {
    id: "c1",
    name: "test-app-blue",
    image: "",
    project: "",
    service: "",
    created: "",
    state: "running",
    status: "",
    ports: "",
    ...overrides,
  };
}

describe("waitForHealthy", () => {
  it("accepts a running container reporting healthy", async () => {
    const nodeClient = new FakeNodeCommandClient();
    nodeClient.colorContainerStates = [state({ health: "healthy" })];

    expect(await waitForHealthy(nodeClient, "srv-1", "app-1", "blue", 50)).toBe(
      true,
    );
  });

  it("accepts a running container without a healthcheck", async () => {
    const nodeClient = new FakeNodeCommandClient();
    nodeClient.colorContainerStates = [state({ health: undefined })];

    expect(await waitForHealthy(nodeClient, "srv-1", "app-1", "blue", 50)).toBe(
      true,
    );
  });

  it("rejects a container that is not running", async () => {
    const nodeClient = new FakeNodeCommandClient();
    nodeClient.colorContainerStates = [
      state({ state: "exited", health: "healthy" }),
    ];

    expect(await waitForHealthy(nodeClient, "srv-1", "app-1", "blue", 0)).toBe(
      false,
    );
  });

  it("rejects a running container that is still starting", async () => {
    const nodeClient = new FakeNodeCommandClient();
    nodeClient.colorContainerStates = [state({ health: "starting" })];

    expect(await waitForHealthy(nodeClient, "srv-1", "app-1", "blue", 0)).toBe(
      false,
    );
  });
});
