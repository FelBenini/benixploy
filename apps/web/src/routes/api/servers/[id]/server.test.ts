import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RequestEvent } from "./$types";

let mockServerGet: ReturnType<typeof vi.fn>;
let mockUpdateConnection: ReturnType<typeof vi.fn>;

vi.mock("$lib/server/app", () => {
  mockServerGet = vi.fn();
  mockUpdateConnection = vi.fn();
  return {
    app: {
      repo: {
        servers: {
          get: mockServerGet,
          updateConnection: mockUpdateConnection,
        },
      },
      useCases: {},
    },
  };
});

const { GET, PATCH } = await import("./+server");

function createRequestEvent(
  params: { id: string },
  locals?: { session: unknown; orgId: string | null },
  method = "GET",
  body?: unknown,
): RequestEvent {
  return {
    params,
    request: new Request("http://localhost:5173/api/servers/" + params.id, {
      method,
      headers:
        method === "PATCH"
          ? {
              "Content-Type": "application/json",
              Origin: "http://localhost:5173",
              Host: "localhost:5173",
            }
          : { Origin: "http://localhost:5173", Host: "localhost:5173" },
      body: body ? JSON.stringify(body) : undefined,
    }),
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      serialize: vi.fn(),
    },
    locals: locals ?? {
      session: { id: "sess-1", userId: "user-1" },
      orgId: "org-1",
    },
  } as unknown as RequestEvent;
}

function serverFixture() {
  return {
    id: "server-1",
    name: "my-server",
    address: "192.168.1.100",
    sshPort: 22,
    sshUser: "root",
    sshPrivateKey: "enc:...",
    status: "provisioning",
    cpuCores: 4,
    memoryBytes: 8589934592,
    diskBytes: 256000000000,
    labels: {},
    hostKeyFingerprint: null,
    lastHeartbeatAt: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };
}

describe("GET /api/servers/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no session", async () => {
    const event = createRequestEvent(
      { id: "server-1" },
      { session: null, orgId: null },
    );
    const response = await GET(event);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 404 when server not found", async () => {
    mockServerGet.mockResolvedValue(null);

    const event = createRequestEvent({ id: "nonexistent" });
    const response = await GET(event);

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Server not found");
    expect(mockServerGet).toHaveBeenCalledWith("org-1", "nonexistent");
  });

  it("returns 200 with server data, never the SSH private key", async () => {
    const server = serverFixture();
    mockServerGet.mockResolvedValue(server);

    const event = createRequestEvent({ id: "server-1" });
    const response = await GET(event);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual({ ...server, sshPrivateKey: undefined });
    expect(body.data.sshPrivateKey).toBeUndefined();
    expect(mockServerGet).toHaveBeenCalledWith("org-1", "server-1");
  });
});

describe("PATCH /api/servers/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no session", async () => {
    const event = createRequestEvent(
      { id: "server-1" },
      { session: null, orgId: null },
      "PATCH",
      { address: "10.0.0.1" },
    );
    const response = await PATCH(event);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 404 when server not found", async () => {
    mockServerGet.mockResolvedValue(null);

    const event = createRequestEvent(
      { id: "nonexistent" },
      undefined,
      "PATCH",
      { address: "10.0.0.1" },
    );
    const response = await PATCH(event);

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Server not found");
  });

  it("returns 400 for invalid body", async () => {
    mockServerGet.mockResolvedValue(serverFixture());

    const event = createRequestEvent({ id: "server-1" }, undefined, "PATCH", {
      sshPort: 99999,
    });
    const response = await PATCH(event);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid request");
  });

  it("returns 400 for empty JSON", async () => {
    mockServerGet.mockResolvedValue(serverFixture());

    const event = createRequestEvent(
      { id: "server-1" },
      undefined,
      "PATCH",
      "not-json",
    );
    (event.request.json as () => Promise<unknown>) = () =>
      Promise.reject(new Error("Invalid JSON"));

    const response = await PATCH(event);
    expect(response.status).toBe(400);
  });

  it("updates address and returns updated server", async () => {
    const existing = serverFixture();
    const updated = {
      ...existing,
      address: "10.0.0.1",
      updatedAt: "2025-01-02T00:00:00.000Z",
    };
    mockServerGet.mockResolvedValue(existing);
    mockUpdateConnection.mockResolvedValue(updated);

    const event = createRequestEvent({ id: "server-1" }, undefined, "PATCH", {
      address: "10.0.0.1",
    });
    const response = await PATCH(event);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual({ ...updated, sshPrivateKey: undefined });
    expect(body.data.sshPrivateKey).toBeUndefined();
    expect(mockUpdateConnection).toHaveBeenCalledWith("org-1", "server-1", {
      address: "10.0.0.1",
    });
  });

  it("updates multiple fields at once", async () => {
    const existing = serverFixture();
    const updated = {
      ...existing,
      name: "renamed",
      address: "10.0.0.2",
      sshPort: 2222,
      updatedAt: "2025-01-02T00:00:00.000Z",
    };
    mockServerGet.mockResolvedValue(existing);
    mockUpdateConnection.mockResolvedValue(updated);

    const event = createRequestEvent({ id: "server-1" }, undefined, "PATCH", {
      name: "renamed",
      address: "10.0.0.2",
      sshPort: 2222,
    });
    const response = await PATCH(event);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.name).toBe("renamed");
    expect(body.data.address).toBe("10.0.0.2");
    expect(body.data.sshPort).toBe(2222);
  });
});
