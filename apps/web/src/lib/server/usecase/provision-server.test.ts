import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import { generateKeyPairSync } from "node:crypto";
import { createServer, type Server } from "node:http";
import { networkInterfaces } from "node:os";
import { utils } from "ssh2";
import { InMemoryRepository, TEST_ORG_ID } from "./test-utils";
import {
  createProvisionServer,
  type ProvisionEvent,
  type ProvisionPhase,
} from "./provision-server";
import type { ProvisionServerInput } from "../domain/server";
import { join } from "node:path";

const DOCKERFILE_DIR = join(process.cwd(), "../../deploy/test-node");

// The test-node container reaches the control plane (this test process) via
// `host.docker.internal`, which must resolve to an IP the container can
// route to. Under rootless Docker the bridge gateway isn't reachable from
// containers, so resolve the host's non-internal IPv4 address instead.
function hostLanIp(): string {
  const ifaces = networkInterfaces();
  for (const addrs of Object.values(ifaces)) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal) {
        return addr.address;
      }
    }
  }
  throw new Error("Failed to resolve host LAN IP");
}

function generateTestKeyPair(): { publicKey: string; privateKey: string } {
  const keyPair = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "pkcs1", format: "pem" },
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
  });
  const parsed = utils.parseKey(keyPair.privateKey);
  if (parsed instanceof Error) {
    throw new Error(`Failed to parse key: ${parsed.message}`);
  }
  const publicKeySsh = `${parsed.type} ${parsed.getPublicSSH().toString("base64")}`;
  return { publicKey: publicKeySsh, privateKey: keyPair.privateKey };
}

async function injectPublicKey(
  container: StartedTestContainer,
  publicKey: string,
) {
  const b64 = Buffer.from(`${publicKey}\n`).toString("base64");
  await container.exec([
    "bash",
    "-c",
    `echo ${b64} | base64 -d >> /root/.ssh/authorized_keys`,
  ]);
}

async function collectEvents(
  gen: AsyncIterable<ProvisionEvent>,
): Promise<ProvisionEvent[]> {
  const events: ProvisionEvent[] = [];
  for await (const e of gen) events.push(e);
  return events;
}

function isPhase(e: ProvisionEvent): e is ProvisionPhase {
  return "phase" in e && "status" in e && !("type" in e);
}

function phaseEvents(events: ProvisionEvent[]): ProvisionPhase[] {
  return events.filter(isPhase);
}

function lastEvent(events: ProvisionEvent[]): ProvisionEvent {
  return events[events.length - 1];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function baseServer(): any {
  return {
    sshPrivateKey: "",
    status: "provisioning" as const,
    cpuCores: 0,
    memoryBytes: 0,
    diskBytes: 0,
    labels: {} as Record<string, string>,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("provisionServer", () => {
  let container: StartedTestContainer;
  let host: string;
  let port: number;
  let repo: InMemoryRepository;
  let binaryServer: Server;
  let binaryServerPort: number;
  let failMonitorDownload = false;

  // Disable Ryuk locally with TESTCONTAINERS_RYUK_DISABLED=true
  // (rootless port conflict on this machine). CI uses Ryuk by default.
  beforeAll(async () => {
    // Serve the node-monitor download endpoint the same way the control
    // plane would (install.sh fetches the binary from it during setup).
    binaryServer = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname === "/api/servers/install/node-monitor") {
        if (failMonitorDownload) {
          res.writeHead(500);
          res.end("simulated download failure");
          return;
        }
        res.writeHead(200, {
          "Content-Type": "application/octet-stream",
        });
        res.end(Buffer.from("dummy-node-monitor-binary"));
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((resolve) =>
      binaryServer.listen(0, "0.0.0.0", resolve),
    );
    const addr = binaryServer.address();
    if (addr && typeof addr === "object") {
      binaryServerPort = addr.port;
    } else {
      throw new Error("Failed to start binary server");
    }

    const built = await GenericContainer.fromDockerfile(DOCKERFILE_DIR)
      .withBuildkit()
      .build("benisploy-test-node", { deleteOnExit: false });
    container = await built
      .withExposedPorts(2222)
      .withPrivilegedMode()
      .withExtraHosts([
        { host: "host.docker.internal", ipAddress: hostLanIp() },
      ])
      .start();
    host = container.getHost();
    port = container.getMappedPort(2222);
    await new Promise((r) => setTimeout(r, 3000));
  }, 180_000);

  afterAll(async () => {
    await container?.stop();
    await new Promise<void>((resolve) => binaryServer?.close(() => resolve()));
  });

  beforeEach(() => {
    repo = new InMemoryRepository();
    failMonitorDownload = false;
  });

  function makeInput(overrides?: Partial<ProvisionServerInput>) {
    return {
      accessMethod: "password" as const,
      sshUser: "root",
      password: "password",
      ...overrides,
    };
  }

  async function seedServer(
    addr: string,
    pt: number,
    sshUser = "root",
  ): Promise<string> {
    const id = crypto.randomUUID();
    await repo.servers.create(TEST_ORG_ID, {
      id,
      name: "test-node",
      address: addr,
      sshPort: pt,
      sshUser,
      ...baseServer(),
    });
    return id;
  }

  // Simulates the telemetry ingest endpoint touching the server heartbeat
  // when the node monitor's first push arrives (the test-node container has
  // no systemd, so the real monitor binary never runs there).
  function injectHeartbeat(serverId: string, delayMs = 4000): NodeJS.Timeout {
    return setTimeout(() => {
      void repo.servers.touchHeartbeat(serverId);
    }, delayMs);
  }

  const controlPlaneUrl = () =>
    `http://host.docker.internal:${binaryServerPort}`;

  // ── Happy path: password auth ──────────────────────────────────────────

  it("provisions a server with password auth and persists everything", async () => {
    const orgId = TEST_ORG_ID;
    const serverId = await seedServer(host, port, "root");

    const provisionServer = createProvisionServer(repo);
    const heartbeatTimer = injectHeartbeat(serverId);
    const events = await collectEvents(
      provisionServer(orgId, serverId, makeInput(), {
        controlPlaneUrl: controlPlaneUrl(),
      }),
    );
    clearTimeout(heartbeatTimer);

    // ── Event sequence ──────────────────────────────────────
    const phases = phaseEvents(events);
    expect(phases.length).toBeGreaterThanOrEqual(6);

    // Phase 0: active → done
    expect(
      phases.find((p) => p.phase === 0 && p.status === "active"),
    ).toBeDefined();
    expect(
      phases.find((p) => p.phase === 0 && p.status === "done"),
    ).toBeDefined();

    // Phase 1: active → done
    expect(
      phases.find((p) => p.phase === 1 && p.status === "active"),
    ).toBeDefined();
    expect(
      phases.find((p) => p.phase === 1 && p.status === "done"),
    ).toBeDefined();

    // Phase 2: active → done
    expect(
      phases.find((p) => p.phase === 2 && p.status === "active"),
    ).toBeDefined();
    expect(
      phases.find((p) => p.phase === 2 && p.status === "done"),
    ).toBeDefined();

    // Phases 3-8 all done
    for (let i = 3; i <= 8; i++) {
      expect(
        phases.find((p) => p.phase === i && p.status === "done"),
      ).toBeDefined();
    }

    // Final done event
    const final = lastEvent(events);
    expect("type" in final && final.type).toBe("done");

    // ── Server updated ──────────────────────────────────────
    const server = await repo.servers.get(orgId, serverId);
    expect(server).not.toBeNull();
    expect(server!.status).toBe("online");
    expect(server!.sshUser).toBe("benisploy");
    expect(server!.cpuCores).toBeGreaterThan(0);
    expect(server!.memoryBytes).toBeGreaterThan(0);
    expect(server!.diskBytes).toBeGreaterThan(0);
    expect(server!.sshPrivateKey).toContain("PRIVATE KEY");

    // ── Registered node created ─────────────────────────────
    const node = await repo.registeredNodes.getByServer(serverId);
    expect(node).not.toBeNull();
    expect(node!.sshPublicKey).toMatch(/^ssh-ed25519 /);
    expect(node!.monitorBearerToken.length).toBeGreaterThan(0);

    // ── Container-side assertions ───────────────────────────
    const userCheck = await container.exec(["id", "benisploy"]);
    expect(userCheck.exitCode).toBe(0);

    const scriptCheck = await container.exec([
      "bash",
      "-c",
      "test -x /opt/benisploy/bin/exec-command.sh",
    ]);
    expect(scriptCheck.exitCode).toBe(0);

    const authKeys = await container.exec([
      "cat",
      "/opt/benisploy/.ssh/authorized_keys",
    ]);
    expect(authKeys.output).toContain(node!.sshPublicKey);
  }, 180_000);

  // ── Happy path: key auth ──────────────────────────────────────────────

  it("provisions a server with SSH key auth", async () => {
    const keyPair = generateTestKeyPair();
    await injectPublicKey(container, keyPair.publicKey);

    const orgId = TEST_ORG_ID;
    const serverId = await seedServer(host, port, "root");

    const provisionServer = createProvisionServer(repo);
    const heartbeatTimer = injectHeartbeat(serverId);
    const events = await collectEvents(
      provisionServer(
        orgId,
        serverId,
        makeInput({
          accessMethod: "key",
          privateKey: keyPair.privateKey,
          password: undefined,
        }),
        { controlPlaneUrl: controlPlaneUrl() },
      ),
    );
    clearTimeout(heartbeatTimer);

    const final = lastEvent(events);
    expect("type" in final && final.type).toBe("done");

    const server = await repo.servers.get(orgId, serverId);
    expect(server).not.toBeNull();
    expect(server!.sshPrivateKey).toContain("PRIVATE KEY");

    const node = await repo.registeredNodes.getByServer(serverId);
    expect(node).not.toBeNull();
  }, 180_000);

  // ── Failure: node-monitor download ────────────────────────────────────

  it("marks completed steps done and fails at node-monitor install", async () => {
    failMonitorDownload = true;

    const orgId = TEST_ORG_ID;
    const serverId = await seedServer(host, port, "root");

    const provisionServer = createProvisionServer(repo);
    const events = await collectEvents(
      provisionServer(orgId, serverId, makeInput(), {
        controlPlaneUrl: controlPlaneUrl(),
      }),
    );

    const phases = phaseEvents(events);

    // Steps that completed before the failure get a done tick...
    for (const p of [2, 3, 4, 5]) {
      expect(
        phases.find((e) => e.phase === p && e.status === "done"),
        `phase ${p} should be done`,
      ).toBeDefined();
    }

    // ...the failing step (node-monitor) is not done.
    expect(
      phases.find((e) => e.phase === 6 && e.status === "done"),
    ).toBeUndefined();

    // Error event points at the failed phase.
    const lastEv = lastEvent(events);
    expect("type" in lastEv && lastEv.type).toBe("error");
    if ("type" in lastEv && lastEv.type === "error") {
      expect(lastEv.phase).toBe(6);
    }

    // Nothing persisted — server stays provisioning, no registered node.
    const server = await repo.servers.get(orgId, serverId);
    expect(server!.status).toBe("provisioning");

    const node = await repo.registeredNodes.getByServer(serverId);
    expect(node).toBeNull();
  }, 180_000);

  // ── Failure: wrong password ───────────────────────────────────────────

  it("yields an error event on wrong password", async () => {
    const orgId = TEST_ORG_ID;
    const serverId = await seedServer(host, port, "root");

    const provisionServer = createProvisionServer(repo);
    const events = await collectEvents(
      provisionServer(orgId, serverId, makeInput({ password: "wrong" }), {
        controlPlaneUrl: "http://cp.example.com",
      }),
    );

    expect(events.length).toBeGreaterThanOrEqual(1);
    const lastEv = lastEvent(events);
    expect("type" in lastEv && lastEv.type).toBe("error");

    // Server stays in provisioning state
    const server = await repo.servers.get(orgId, serverId);
    expect(server!.status).toBe("provisioning");

    // No registered node
    const node = await repo.registeredNodes.getByServer(serverId);
    expect(node).toBeNull();
  }, 60_000);

  // ── Failure: server not found ─────────────────────────────────────────

  it("yields an error event when server is not found", async () => {
    const provisionServer = createProvisionServer(repo);
    const events = await collectEvents(
      provisionServer(TEST_ORG_ID, "nonexistent", makeInput()),
    );

    expect(events.length).toBe(1);
    const ev = events[0];
    expect("type" in ev && ev.type).toBe("error");
    if ("type" in ev && ev.type === "error") {
      expect(ev.message).toBe("Server not found");
    }
  });

  // ── Failure: unreachable host ─────────────────────────────────────────

  it("yields an error event when the host is unreachable", async () => {
    const serverId = crypto.randomUUID();
    await repo.servers.create(TEST_ORG_ID, {
      id: serverId,
      name: "dead",
      address: "127.0.0.1",
      sshPort: 1,
      sshUser: "root",
      ...baseServer(),
    });

    const provisionServer = createProvisionServer(repo);
    const events = await collectEvents(
      provisionServer(TEST_ORG_ID, serverId, makeInput()),
    );

    const final = lastEvent(events);
    expect("type" in final && final.type).toBe("error");
  }, 30_000);
});
