import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RequestEvent } from "./$types";

const mockCreateManifestState = vi.hoisted(() => vi.fn());

vi.mock("$lib/server/app", () => ({
  app: {
    oauthStates: {
      createManifestState: mockCreateManifestState,
    },
  },
}));

const { GET } = await import("./+server");

function createRequestEvent(locals?: Record<string, unknown>): RequestEvent {
  return {
    request: new Request("http://localhost:5173/api/git/github/manifest"),
    url: new URL("http://localhost:5173/api/git/github/manifest"),
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      serialize: vi.fn(),
    },
    locals: locals ?? { session: { userId: "user-1" }, orgId: "org-1" },
  } as unknown as RequestEvent;
}

describe("GET /api/git/github/manifest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateManifestState.mockResolvedValue("nonce-1");
  });

  it("redirects to login when unauthenticated", async () => {
    const event = createRequestEvent({ session: null, orgId: null });
    await expect(GET(event)).rejects.toMatchObject({
      status: 302,
      location: "/login",
    });
    expect(mockCreateManifestState).not.toHaveBeenCalled();
  });

  it("redirects to login when the session has no organization", async () => {
    const event = createRequestEvent({
      session: { userId: "user-1" },
      orgId: null,
    });
    await expect(GET(event)).rejects.toMatchObject({
      status: 302,
      location: "/login",
    });
    expect(mockCreateManifestState).not.toHaveBeenCalled();
  });

  it("binds an anti-forgery state to the session's org", async () => {
    const event = createRequestEvent();
    await GET(event);
    expect(mockCreateManifestState).toHaveBeenCalledWith("user-1", "org-1");
  });

  it("returns an auto-submitting form to GitHub", async () => {
    const event = createRequestEvent();
    const response = await GET(event);

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('action="https://github.com/settings/apps/new"');
    expect(html).toContain('name="manifest"');
    expect(html).toContain("github-manifest-form");
    expect(html).toContain(".submit()");
    expect(html).toContain("/api/git/github/manifest-callback");
  });
});
