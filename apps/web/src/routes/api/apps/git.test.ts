import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RequestEvent } from "./git/$types";

let mockFindConnection: ReturnType<typeof vi.fn>;
let mockDeployApp: ReturnType<typeof vi.fn>;
let mockUpsert: ReturnType<typeof vi.fn>;
let mockSetActiveColor: ReturnType<typeof vi.fn>;
let mockListRepositories: ReturnType<typeof vi.fn>;

vi.mock("$lib/server/app", () => {
  mockFindConnection = vi.fn();
  mockDeployApp = vi.fn();
  mockUpsert = vi.fn();
  mockSetActiveColor = vi.fn();
  return {
    app: {
      repo: {
        gitConnections: { findGitConnection: mockFindConnection },
        gitSources: {
          upsert: mockUpsert,
          setActiveColor: mockSetActiveColor,
        },
      },
      useCases: { deployApp: mockDeployApp },
    },
  };
});

vi.mock("$lib/server/adapters/git", () => {
  mockListRepositories = vi.fn();
  return {
    getGitProvider: () => ({ listRepositories: mockListRepositories }),
  };
});

const { POST } = await import("./git/+server");

const CONNECTION = {
  id: "conn-1",
  orgId: "org-1",
  provider: "github",
  name: "GH",
  baseUrl: "https://github.com",
  authKind: "github_app",
  externalId: "123",
  credentials: { appId: "1", clientId: "cid", privateKeyPem: "key" },
  webhookSecret: "secret",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const REPO = {
  slug: "octocat/hello",
  defaultBranch: "main",
  cloneUrl: "https://github.com/octocat/hello.git",
  isPrivate: false,
};

const APP = {
  id: "app-1",
  name: "hello",
  kind: "stateless",
  serverId: "srv-1",
  status: "healthy",
  activeColor: "blue",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

function createRequestEvent(
  body: unknown,
  locals: Record<string, unknown> = {
    session: { id: "sess-1" },
    orgId: "org-1",
  },
): RequestEvent {
  return {
    request: new Request("http://localhost:5173/api/apps/git", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    locals,
  } as unknown as RequestEvent;
}

const VALID_BODY = {
  serverId: "srv-1",
  connectionId: "conn-1",
  repoSlug: "octocat/hello",
  name: "hello",
  port: 3000,
};

describe("POST /api/apps/git", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindConnection.mockResolvedValue(CONNECTION);
    mockListRepositories.mockResolvedValue([REPO]);
    mockDeployApp.mockResolvedValue({ app: APP, deployment: { id: "dep-1" } });
    mockUpsert.mockResolvedValue({});
    mockSetActiveColor.mockResolvedValue(undefined);
  });

  it("returns 401 without a session", async () => {
    const res = await POST(
      createRequestEvent(VALID_BODY, { session: null, orgId: null }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid body", async () => {
    const res = await POST(createRequestEvent({ name: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown connection", async () => {
    mockFindConnection.mockResolvedValue(null);
    const res = await POST(createRequestEvent(VALID_BODY));
    expect(res.status).toBe(404);
  });

  it("returns 502 when repository listing fails", async () => {
    mockListRepositories.mockRejectedValue(new Error("bad token"));
    const res = await POST(createRequestEvent(VALID_BODY));
    expect(res.status).toBe(502);
  });

  it("returns 400 for a repository not visible to the connection", async () => {
    mockListRepositories.mockResolvedValue([]);
    const res = await POST(createRequestEvent(VALID_BODY));
    expect(res.status).toBe(400);
  });

  it("creates the app, attaches the git source, and mirrors active color", async () => {
    const res = await POST(createRequestEvent(VALID_BODY));

    expect(res.status).toBe(201);

    expect(mockDeployApp).toHaveBeenCalledWith(
      "org-1",
      {
        kind: "stateless",
        name: "hello",
        buildContext: REPO.cloneUrl,
        ports: [{ container: 3000, protocol: "tcp" }],
        volumeMounts: [],
        envVars: {},
      },
      "srv-1",
    );

    expect(mockUpsert).toHaveBeenCalledWith({
      appId: "app-1",
      connectionId: "conn-1",
      provider: "github",
      repoSlug: "octocat/hello",
      cloneUrl: REPO.cloneUrl,
      branch: "main",
    });
    expect(mockSetActiveColor).toHaveBeenCalledWith("app-1", "blue");
  });

  it("returns 500 when the first deploy fails", async () => {
    mockDeployApp.mockRejectedValue(new Error("build failed"));
    const res = await POST(createRequestEvent(VALID_BODY));
    expect(res.status).toBe(500);
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
