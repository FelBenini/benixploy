import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RequestEvent } from "./$types";

const mockUpsertGitConnection = vi.hoisted(() => vi.fn());
const mockConsumeManifestState = vi.hoisted(() => vi.fn());

vi.mock("$lib/server/app", () => ({
  app: {
    repo: {
      gitConnections: {
        upsertGitConnection: mockUpsertGitConnection,
      },
    },
    oauthStates: {
      consumeManifestState: mockConsumeManifestState,
    },
  },
}));

const { GET } = await import("./+server");

function createRequestEvent(query: string, locals?: Record<string, unknown>) {
  return {
    request: new Request(
      `http://localhost:5173/api/git/github/manifest-callback${query}`,
    ),
    url: new URL(
      `http://localhost:5173/api/git/github/manifest-callback${query}`,
    ),
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      serialize: vi.fn(),
    },
    locals: locals ?? {
      session: { userId: "user-1" },
      orgId: "org-1",
    },
  } as unknown as RequestEvent;
}

describe("GET /api/git/github/manifest-callback", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    mockConsumeManifestState.mockResolvedValue(true);
  });

  it("redirects to login when unauthenticated", async () => {
    const event = createRequestEvent("?code=abc", {
      session: null,
      orgId: null,
    });
    await expect(GET(event)).rejects.toMatchObject({
      status: 302,
      location: "/login",
    });
    expect(mockConsumeManifestState).not.toHaveBeenCalled();
  });

  it("redirects with error when code is missing", async () => {
    const event = createRequestEvent("");
    await expect(GET(event)).rejects.toMatchObject({
      status: 302,
      location: "/git-sources?error=manifest_failed",
    });
    expect(mockConsumeManifestState).not.toHaveBeenCalled();
  });

  it("refuses to exchange the code when no pending state exists", async () => {
    mockConsumeManifestState.mockResolvedValue(false);
    const event = createRequestEvent("?code=stolen");
    await expect(GET(event)).rejects.toMatchObject({
      status: 302,
      location: "/git-sources?error=manifest_failed",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockUpsertGitConnection).not.toHaveBeenCalled();
  });

  it("consumes the state bound to the session's org before exchanging", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 4719981,
          client_id: "Iv1.abcdef",
          pem: "-----BEGIN RSA PRIVATE KEY-----\nxxx",
        }),
        { status: 201 },
      ),
    );
    mockUpsertGitConnection.mockResolvedValue({ id: "conn-1" });

    const event = createRequestEvent("?code=valid");
    await expect(GET(event)).rejects.toMatchObject({
      status: 302,
      location: "/git-sources/new?step=install&id=conn-1",
    });
    expect(mockConsumeManifestState).toHaveBeenCalledWith("user-1", "org-1");
  });

  it("redirects with expired when conversion fails", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    const event = createRequestEvent("?code=expired");
    await expect(GET(event)).rejects.toMatchObject({
      status: 302,
      location: "/git-sources?error=manifest_expired",
    });
  });

  it("creates the connection and redirects to the wizard install step", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 4719981,
          slug: "benisploy",
          client_id: "Iv1.abcdef",
          pem: "-----BEGIN RSA PRIVATE KEY-----\nxxx",
          webhook_secret: "ws-secret",
          name: "benisploy",
        }),
        { status: 201 },
      ),
    );
    mockUpsertGitConnection.mockResolvedValue({
      id: "conn-1",
      provider: "github",
      name: "benisploy",
      baseUrl: "https://github.com",
      authKind: "github_app",
      externalId: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    });

    const event = createRequestEvent("?code=valid");
    await expect(GET(event)).rejects.toMatchObject({
      status: 302,
      location: "/git-sources/new?step=install&id=conn-1",
    });

    expect(mockUpsertGitConnection).toHaveBeenCalledWith("org-1", {
      authKind: "github_app",
      provider: "github",
      name: "benisploy",
      baseUrl: "https://github.com",
      credentials: {
        appId: "4719981",
        clientId: "Iv1.abcdef",
        privateKeyPem: "-----BEGIN RSA PRIVATE KEY-----\nxxx",
      },
      webhookSecret: "ws-secret",
    });
  });

  it("redirects with error when conversion response is incomplete", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 4719981 }), { status: 201 }),
    );
    const event = createRequestEvent("?code=partial");
    await expect(GET(event)).rejects.toMatchObject({
      status: 302,
      location: "/git-sources?error=manifest_failed",
    });
    expect(mockUpsertGitConnection).not.toHaveBeenCalled();
  });
});
