import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RequestEvent } from "./trigger-push/$types";

let mockAppsGet: ReturnType<typeof vi.fn>;
let mockFindByApp: ReturnType<typeof vi.fn>;
let mockPushCreate: ReturnType<typeof vi.fn>;
let mockPushUpdateStatus: ReturnType<typeof vi.fn>;
let mockEnqueue: ReturnType<typeof vi.fn>;

vi.mock("$lib/server/app", () => {
  mockAppsGet = vi.fn();
  mockFindByApp = vi.fn();
  mockPushCreate = vi.fn();
  mockPushUpdateStatus = vi.fn();
  mockEnqueue = vi.fn();
  return {
    app: {
      repo: {
        apps: { get: mockAppsGet },
        gitSources: { findByApp: mockFindByApp },
        pushEvents: {
          create: mockPushCreate,
          updateStatus: mockPushUpdateStatus,
        },
      },
      jobQueue: { enqueue: mockEnqueue },
    },
  };
});

const { POST } = await import("./trigger-push/+server");

const APP = {
  id: "app-1",
  name: "test-app",
  kind: "stateless",
  serverId: "srv-1",
  status: "healthy",
  activeColor: "blue",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const SOURCE = {
  id: "src-1",
  appId: "app-1",
  connectionId: "conn-1",
  provider: "github",
  repoSlug: "octocat/hello",
  cloneUrl: "https://github.com/octocat/hello.git",
  branch: "main",
  shaDeployed: "abc1234",
  activeColor: "blue",
  warmColor: null,
  warmExpiresAt: null,
  lastPushAt: null,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

function createRequestEvent(
  body: unknown = {},
  locals: Record<string, unknown> = {
    session: { id: "sess-1" },
    orgId: "org-1",
  },
): RequestEvent {
  return {
    params: { id: "app-1" },
    request: new Request("http://localhost:5173/api/apps/app-1/trigger-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    locals,
  } as unknown as RequestEvent;
}

describe("POST /api/apps/[id]/trigger-push", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppsGet.mockResolvedValue(APP);
    mockFindByApp.mockResolvedValue(SOURCE);
    mockPushCreate.mockImplementation(
      async (input: Record<string, unknown>) => ({
        id: "pe-1",
        receivedAt: new Date().toISOString(),
        ...input,
      }),
    );
    mockEnqueue.mockResolvedValue({ queued: true });
  });

  it("returns 401 without a session", async () => {
    const response = await POST(
      createRequestEvent({}, { session: null, orgId: null }),
    );
    expect(response.status).toBe(401);
  });

  it("returns 404 for an unknown app", async () => {
    mockAppsGet.mockResolvedValue(null);
    const response = await POST(createRequestEvent());
    expect(response.status).toBe(404);
  });

  it("returns 400 without a git source", async () => {
    mockFindByApp.mockResolvedValue(null);
    const response = await POST(createRequestEvent());
    expect(response.status).toBe(400);
  });

  it("returns 400 when the git source has no connection", async () => {
    mockFindByApp.mockResolvedValue({ ...SOURCE, connectionId: null });
    const response = await POST(createRequestEvent());
    expect(response.status).toBe(400);
  });

  it("creates a push event and enqueues the deploy job", async () => {
    const response = await POST(createRequestEvent({ sha: "deadbeef" }));

    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.data).toMatchObject({
      pushEventId: "pe-1",
      sha: "deadbeef",
      branch: "main",
      status: "queued",
    });

    expect(mockPushCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: "app-1",
        connectionId: "conn-1",
        provider: "github",
        repoSlug: "octocat/hello",
        branch: "main",
        sha: "deadbeef",
        status: "queued",
      }),
    );

    expect(mockEnqueue).toHaveBeenCalledWith({
      orgId: "org-1",
      appId: "app-1",
      pushEventId: "pe-1",
      sha: "deadbeef",
      repoSlug: "octocat/hello",
      branch: "main",
      cloneUrl: "https://github.com/octocat/hello.git",
      connectionId: "conn-1",
    });
  });

  it("defaults to a test SHA and the tracked branch", async () => {
    const response = await POST(createRequestEvent({}));

    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.data.sha).toMatch(/^test-\d+$/);
    expect(body.data.branch).toBe("main");
  });

  it("returns 409 and marks skipped_dupe when a deploy is in flight", async () => {
    mockEnqueue.mockResolvedValue({ queued: false, reason: "in-flight" });

    const response = await POST(createRequestEvent());

    expect(response.status).toBe(409);
    expect(mockPushUpdateStatus).toHaveBeenCalledWith("pe-1", "skipped_dupe");
  });
});
