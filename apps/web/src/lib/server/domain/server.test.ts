import { describe, it, expect } from "vitest";
import { toPublicServer, type Server } from "./server";

const server: Server = {
  id: "server-1",
  name: "my-server",
  description: "prod node",
  address: "192.168.1.100",
  sshPort: 22,
  sshUser: "benisploy",
  sshPrivateKey: "-----BEGIN OPENSSH PRIVATE KEY-----\nsecret",
  status: "online",
  cpuCores: 4,
  memoryBytes: 8589934592,
  diskBytes: 256000000000,
  labels: { env: "prod" },
  lastHeartbeatAt: "2025-01-01T00:00:00.000Z",
  hostKeyFingerprint: "SHA256:abc",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

describe("toPublicServer", () => {
  it("strips the SSH private key", () => {
    const publicServer = toPublicServer(server);
    expect(publicServer).not.toHaveProperty("sshPrivateKey");
  });

  it("preserves every other field", () => {
    const publicServer = toPublicServer(server);
    const { sshPrivateKey: _key, ...expected } = server;
    expect(publicServer).toEqual(expected);
  });
});
