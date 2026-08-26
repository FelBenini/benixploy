import { describe, it, expect, vi } from "vitest";
import type { RequestEvent } from "./$types";
import { GET, buildManifest } from "./+server";

function createRequestEvent(url: string): RequestEvent {
  return {
    request: new Request(url),
    url: new URL(url),
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      serialize: vi.fn(),
    },
    locals: {},
  } as unknown as RequestEvent;
}

describe("buildManifest", () => {
  it("builds a manifest with correct callbacks and post-install redirect", () => {
    const manifest = buildManifest("http://localhost:5173");

    expect(manifest.name).toBe("benisploy");
    expect(manifest.url).toBe("http://localhost:5173");
    expect(manifest.redirect_url).toBe(
      "http://localhost:5173/api/git/github/manifest-callback",
    );
    expect(manifest.setup_url).toBe(
      "http://localhost:5173/api/git/github/callback",
    );
    expect(manifest.setup_on_update).toBe(true);
    expect(manifest.callback_urls).toBeUndefined();
    expect(manifest.hook_attributes).toEqual({
      url: "http://localhost:5173/api/git/events",
      active: false,
    });
    expect(manifest.public).toBe(false);
    expect(manifest.request_oauth_on_install).toBe(false);
    expect(manifest.default_permissions).toEqual({
      contents: "read",
      metadata: "read",
    });
    expect(manifest.default_events).toEqual(["push"]);
  });
});

describe("GET /api/git/github/manifest", () => {
  it("returns an auto-submitting form to GitHub", async () => {
    const event = createRequestEvent(
      "http://localhost:5173/api/git/github/manifest",
    );
    const response = await GET(event);

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('action="https://github.com/settings/apps/new"');
    expect(html).toContain('name="manifest"');
    expect(html).toContain("github-manifest-form");
    expect(html).toContain(".submit()");
  });
});
