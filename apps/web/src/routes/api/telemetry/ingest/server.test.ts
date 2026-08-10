import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RequestEvent } from "./$types";

const mockGetByBearerToken = vi.fn();
const mockInsertStats = vi.fn();
const mockInsertEvent = vi.fn();
const mockTouchHeartbeat = vi.fn();

vi.mock("$lib/server/app", () => ({
  app: {
    repo: {
      registeredNodes: { getByBearerToken: mockGetByBearerToken },
      nodeEvents: {
        insertStats: mockInsertStats,
        insertEvent: mockInsertEvent,
      },
      servers: { touchHeartbeat: mockTouchHeartbeat },
    },
  },
}));

const { POST } = await import("./+server");

function createRequestEvent(opts?: {
  authorization?: string;
  body?: unknown;
}): RequestEvent {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts?.authorization !== undefined) {
    headers["Authorization"] = opts.authorization;
  }

  return {
    request: new Request("http://localhost:5173/api/telemetry/ingest", {
      method: "POST",
      headers,
      body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
    }),
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      serialize: vi.fn(),
    },
    locals: {},
  } as unknown as RequestEvent;
}

const activeNode = {
  id: "node-1",
  serverId: "server-1",
  sshPublicKey: "ssh-ed25519 AAA...",
  monitorBearerToken: "bearer-token-active",
  status: "active",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const revokedNode = {
  ...activeNode,
  status: "revoked",
};

const disabledNode = {
  ...activeNode,
  status: "disabled",
};

const statsPushMessage = {
  type: "stats_push",
  id: "msg-stats-1",
  timestamp: "2025-01-01T00:00:00Z",
  payload: {
    cpuPercent: 50,
    memory: { total: 8589934592, used: 4294967296, available: 4294967296 },
    disk: { total: 256000000000, used: 128000000000 },
    uptime: 3600,
    containerCount: 5,
    containerStates: [{ id: "abc", name: "web", state: "running" }],
  },
};

const eventPushMessage = {
  type: "event_push",
  id: "msg-event-1",
  timestamp: "2025-01-01T00:00:00Z",
  payload: {
    eventType: "die",
    containerId: "abc123",
    containerName: "my-app_web_1",
    appId: "app-1",
    timestamp: "2025-01-01T00:00:00Z",
    extra: {},
  },
};

const heartbeatMessage = {
  type: "heartbeat",
  id: "msg-hb-1",
  timestamp: "2025-01-01T00:00:00Z",
  payload: {
    serverId: "server-1",
    hostname: "my-vps",
    cpuPercent: 25,
    memoryUsed: 2048576000,
    memoryTotal: 4294967296,
    diskUsed: 50000000000,
    diskTotal: 256000000000,
    uptimeSeconds: 86400,
  },
};

const deployMessage = {
  type: "deploy",
  id: "msg-deploy-1",
  timestamp: "2025-01-01T00:00:00Z",
  payload: {
    deploymentId: "deploy-1",
    appSpec: {
      name: "test",
      image: "nginx:latest",
      envVars: {},
      ports: [],
      volumeMounts: [],
    },
  },
};

describe("POST /api/telemetry/ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Auth ──────────────────────────────────────────────────────

  describe("authentication", () => {
    it("returns 401 when Authorization header is missing", async () => {
      const event = createRequestEvent({ authorization: undefined });
      const response = await POST(event);
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("Missing or invalid Authorization header");
    });

    it("returns 401 when Authorization header has no Bearer prefix", async () => {
      const event = createRequestEvent({
        authorization: "Basic dXNlcjpwYXNz",
      });
      const response = await POST(event);
      expect(response.status).toBe(401);
    });

    it("returns 401 when Bearer token is empty", async () => {
      const event = createRequestEvent({
        authorization: "Bearer ",
      });
      const response = await POST(event);
      expect(response.status).toBe(401);
    });

    it("returns 401 when Bearer token is only whitespace", async () => {
      const event = createRequestEvent({
        authorization: "Bearer    ",
      });
      const response = await POST(event);
      expect(response.status).toBe(401);
    });

    it("returns 401 for an unknown token", async () => {
      mockGetByBearerToken.mockResolvedValue(null);

      const event = createRequestEvent({
        authorization: "Bearer unknown-token",
        body: statsPushMessage,
      });
      const response = await POST(event);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("Unauthorized");
      expect(mockGetByBearerToken).toHaveBeenCalledWith("unknown-token");
    });

    it("returns 401 for a revoked token", async () => {
      mockGetByBearerToken.mockResolvedValue(revokedNode);

      const event = createRequestEvent({
        authorization: "Bearer revoked-token",
        body: statsPushMessage,
      });
      const response = await POST(event);

      expect(response.status).toBe(401);
      expect(mockGetByBearerToken).toHaveBeenCalledWith("revoked-token");
    });

    it("returns 401 for a disabled token", async () => {
      mockGetByBearerToken.mockResolvedValue(disabledNode);

      const event = createRequestEvent({
        authorization: "Bearer disabled-token",
        body: statsPushMessage,
      });
      const response = await POST(event);

      expect(response.status).toBe(401);
    });
  });

  // ── Body parsing ──────────────────────────────────────────────

  describe("body parsing", () => {
    it("returns 400 for a non-JSON body", async () => {
      mockGetByBearerToken.mockResolvedValue(activeNode);

      const event = {
        request: new Request("http://localhost:5173/api/telemetry/ingest", {
          method: "POST",
          headers: {
            "Content-Type": "text/plain",
            Authorization: "Bearer bearer-token-active",
          },
          body: "not-json",
        }),
        cookies: {
          get: vi.fn(),
          set: vi.fn(),
          delete: vi.fn(),
          serialize: vi.fn(),
        },
        locals: {},
      } as unknown as RequestEvent;

      const response = await POST(event);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("Invalid JSON body");
    });

    it("returns 400 for a message that fails schema validation", async () => {
      mockGetByBearerToken.mockResolvedValue(activeNode);

      const event = createRequestEvent({
        authorization: "Bearer bearer-token-active",
        body: { type: "stats_push" },
      });

      const response = await POST(event);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("Invalid message");
      expect(body.details).toBeDefined();
    });

    it("returns 400 for an unknown message type", async () => {
      mockGetByBearerToken.mockResolvedValue(activeNode);

      const event = createRequestEvent({
        authorization: "Bearer bearer-token-active",
        body: {
          type: "not_a_real_type",
          id: "x",
          timestamp: "2025-01-01T00:00:00Z",
          payload: {},
        },
      });

      const response = await POST(event);
      expect(response.status).toBe(400);
    });
  });

  // ── stats_push ────────────────────────────────────────────────

  describe("stats_push", () => {
    it("returns 202 and persists stats", async () => {
      mockGetByBearerToken.mockResolvedValue(activeNode);
      mockInsertStats.mockResolvedValue({ id: "stats-1" });
      mockTouchHeartbeat.mockResolvedValue(undefined);

      const event = createRequestEvent({
        authorization: "Bearer bearer-token-active",
        body: statsPushMessage,
      });
      const response = await POST(event);

      expect(response.status).toBe(202);
      const body = await response.json();
      expect(body.status).toBe("ok");

      expect(mockInsertStats).toHaveBeenCalledWith("server-1", {
        serverId: "server-1",
        cpuPercent: 50,
        memoryTotal: 8589934592,
        memoryUsed: 4294967296,
        memoryAvailable: 4294967296,
        diskTotal: 256000000000,
        diskUsed: 128000000000,
        uptime: 3600,
        containerCount: 5,
        containerStates: [{ id: "abc", name: "web", state: "running" }],
      });

      expect(mockTouchHeartbeat).toHaveBeenCalledWith("server-1");
      expect(mockInsertEvent).not.toHaveBeenCalled();
    });
  });

  // ── event_push ────────────────────────────────────────────────

  describe("event_push", () => {
    it("returns 202 and persists event with appId", async () => {
      mockGetByBearerToken.mockResolvedValue(activeNode);
      mockInsertEvent.mockResolvedValue({ id: "event-1" });
      mockTouchHeartbeat.mockResolvedValue(undefined);

      const event = createRequestEvent({
        authorization: "Bearer bearer-token-active",
        body: eventPushMessage,
      });
      const response = await POST(event);

      expect(response.status).toBe(202);
      const body = await response.json();
      expect(body.status).toBe("ok");

      expect(mockInsertEvent).toHaveBeenCalledWith(
        "server-1",
        "die",
        expect.objectContaining({
          eventType: "die",
          containerId: "abc123",
          containerName: "my-app_web_1",
        }),
        "app-1",
      );

      expect(mockTouchHeartbeat).toHaveBeenCalledWith("server-1");
      expect(mockInsertStats).not.toHaveBeenCalled();
    });

    it("handles event_push without appId", async () => {
      mockGetByBearerToken.mockResolvedValue(activeNode);
      mockInsertEvent.mockResolvedValue({ id: "event-2" });
      mockTouchHeartbeat.mockResolvedValue(undefined);

      const msgNoAppId = {
        ...eventPushMessage,
        payload: { ...eventPushMessage.payload, appId: undefined },
      };

      const event = createRequestEvent({
        authorization: "Bearer bearer-token-active",
        body: msgNoAppId,
      });
      const response = await POST(event);

      expect(response.status).toBe(202);
      expect(mockInsertEvent).toHaveBeenCalledWith(
        "server-1",
        "die",
        expect.any(Object),
        undefined,
      );
    });
  });

  // ── heartbeat ─────────────────────────────────────────────────

  describe("heartbeat", () => {
    it("returns 202 and touches server heartbeat", async () => {
      mockGetByBearerToken.mockResolvedValue(activeNode);
      mockTouchHeartbeat.mockResolvedValue(undefined);

      const event = createRequestEvent({
        authorization: "Bearer bearer-token-active",
        body: heartbeatMessage,
      });
      const response = await POST(event);

      expect(response.status).toBe(202);
      const body = await response.json();
      expect(body.status).toBe("ok");

      expect(mockTouchHeartbeat).toHaveBeenCalledWith("server-1");
      expect(mockInsertStats).not.toHaveBeenCalled();
      expect(mockInsertEvent).not.toHaveBeenCalled();
    });
  });

  // ── Unhandled but valid message types ─────────────────────────

  describe("unhandled message types", () => {
    it("returns 400 for a deploy message (valid schema, not an ingest concern)", async () => {
      mockGetByBearerToken.mockResolvedValue(activeNode);

      const event = createRequestEvent({
        authorization: "Bearer bearer-token-active",
        body: deployMessage,
      });
      const response = await POST(event);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("Unhandled message type");

      expect(mockInsertStats).not.toHaveBeenCalled();
      expect(mockInsertEvent).not.toHaveBeenCalled();
      expect(mockTouchHeartbeat).not.toHaveBeenCalled();
    });
  });
});
