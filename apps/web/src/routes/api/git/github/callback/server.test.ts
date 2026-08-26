import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RequestEvent } from "./$types";

const mockFindGitConnectionById = vi.hoisted(() => vi.fn());
const mockSetExternalId = vi.hoisted(() => vi.fn());
const mockVerifyInstallation = vi.hoisted(() => vi.fn());

vi.mock("$lib/server/app", () => ({
  app: {
    repo: {
      gitConnections: {
        findGitConnectionById: mockFindGitConnectionById,
        setExternalId: mockSetExternalId,
      },
    },
  },
}));

vi.mock("$lib/server/adapters/git/github", () => ({
  verifyInstallation: mockVerifyInstallation,
}));

const { GET } = await import("./+server");

function createRequestEvent(query: string): RequestEvent {
  return {
    request: new Request(
      `http://localhost:5173/api/git/github/callback${query}`,
    ),
    url: new URL(`http://localhost:5173/api/git/github/callback${query}`),
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      serialize: vi.fn(),
    },
    locals: {},
  } as unknown as RequestEvent;
}

describe("GET /api/git/github/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects with pending when setup_action is request_pending", async () => {
    const event = createRequestEvent(
      "?setup_action=request_pending&installation_id=123",
    );
    await expect(GET(event)).rejects.toMatchObject({
      status: 302,
      location: "/git-sources?installed=pending",
    });
  });

  it("redirects with error when setup_action is unexpected", async () => {
    const event = createRequestEvent("?setup_action=bogus");
    await expect(GET(event)).rejects.toMatchObject({
      status: 302,
      location: "/git-sources?installed=error&reason=unexpected",
    });
  });

  it("redirects with error when installation_id is missing", async () => {
    const event = createRequestEvent("?setup_action=install");
    await expect(GET(event)).rejects.toMatchObject({
      status: 302,
      location: "/git-sources?installed=error&reason=no_installation",
    });
  });

  it("redirects with error when installation_id is not a positive integer", async () => {
    const event = createRequestEvent(
      "?setup_action=install&installation_id=abc",
    );
    await expect(GET(event)).rejects.toMatchObject({
      status: 302,
      location: "/git-sources?installed=error&reason=no_installation",
    });
  });

  it("redirects with error when state is missing", async () => {
    const event = createRequestEvent(
      "?setup_action=install&installation_id=123",
    );
    await expect(GET(event)).rejects.toMatchObject({
      status: 302,
      location: "/git-sources?installed=error&reason=no_state",
    });
  });

  it("redirects with error when connection is unknown", async () => {
    mockFindGitConnectionById.mockResolvedValue(null);
    const event = createRequestEvent(
      "?setup_action=install&installation_id=123&state=conn-1",
    );
    await expect(GET(event)).rejects.toMatchObject({
      status: 302,
      location: "/git-sources?installed=error&reason=unknown_connection",
    });
    expect(mockFindGitConnectionById).toHaveBeenCalledWith("conn-1");
  });

  it("sets externalId and redirects with ok on success", async () => {
    mockVerifyInstallation.mockResolvedValue(true);
    mockFindGitConnectionById.mockResolvedValue({
      id: "conn-1",
      orgId: "org-1",
      provider: "github",
      name: "GitHub App",
      baseUrl: "https://github.com",
      authKind: "github_app",
      externalId: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
      credentials: {
        appId: "app-1",
        clientId: "client-1",
        privateKeyPem: "pem",
      },
      webhookSecret: "secret",
    });
    const event = createRequestEvent(
      "?setup_action=install&installation_id=123&state=conn-1",
    );
    await expect(GET(event)).rejects.toMatchObject({
      status: 302,
      location: "/git-sources?installed=ok",
    });
    expect(mockVerifyInstallation).toHaveBeenCalledWith(
      expect.objectContaining({ id: "conn-1" }),
      "123",
    );
    expect(mockSetExternalId).toHaveBeenCalledWith("org-1", "conn-1", "123");
  });

  it("redirects with error when installation verification fails", async () => {
    mockVerifyInstallation.mockResolvedValue(false);
    mockFindGitConnectionById.mockResolvedValue({
      id: "conn-1",
      orgId: "org-1",
      provider: "github",
      name: "GitHub App",
      baseUrl: "https://github.com",
      authKind: "github_app",
      externalId: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
      credentials: {
        appId: "app-1",
        clientId: "client-1",
        privateKeyPem: "pem",
      },
      webhookSecret: "secret",
    });
    const event = createRequestEvent(
      "?setup_action=install&installation_id=123&state=conn-1",
    );
    await expect(GET(event)).rejects.toMatchObject({
      status: 302,
      location: "/git-sources?installed=error&reason=verify_failed",
    });
    expect(mockSetExternalId).not.toHaveBeenCalled();
  });

  it("accepts setup_action=update as a success", async () => {
    mockVerifyInstallation.mockResolvedValue(true);
    mockFindGitConnectionById.mockResolvedValue({
      id: "conn-1",
      orgId: "org-1",
      provider: "github",
      name: "GitHub App",
      baseUrl: "https://github.com",
      authKind: "github_app",
      externalId: "123",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
      credentials: {
        appId: "app-1",
        clientId: "client-1",
        privateKeyPem: "pem",
      },
      webhookSecret: "secret",
    });
    const event = createRequestEvent(
      "?setup_action=update&installation_id=456&state=conn-1",
    );
    await expect(GET(event)).rejects.toMatchObject({
      status: 302,
      location: "/git-sources?installed=ok",
    });
    expect(mockSetExternalId).toHaveBeenCalledWith("org-1", "conn-1", "456");
  });
});
