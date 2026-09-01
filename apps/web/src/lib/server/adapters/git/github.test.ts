import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { createHmac, generateKeyPairSync } from "crypto";
import {
  githubProviderClient,
  getInstallUrl,
  verifyInstallation,
} from "./github";
import type { GitConnection } from "../../ports/git-provider-client";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const privateKeyPem = privateKey
  .export({ type: "pkcs8", format: "pem" })
  .toString();

function githubConn(overrides?: Partial<GitConnection>): GitConnection {
  return {
    id: "conn-1",
    provider: "github",
    name: "GitHub App",
    baseUrl: "https://github.com",
    authKind: "github_app",
    externalId: "12345",
    credentials: {
      appId: "123456",
      clientId: "Iv1.abcdef",
      privateKeyPem,
    },
    webhookSecret: "webhook-secret",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("getInstallUrl", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("builds the install URL from the resolved slug with the state nonce", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ slug: "benisploy" }), { status: 200 }),
    );

    const url = await getInstallUrl(
      githubConn({ externalId: null }),
      "nonce-123",
    );

    expect(url).toBe(
      "https://github.com/apps/benisploy/installations/new?state=nonce-123",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/app",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("URL-encodes the state nonce", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ slug: "benisploy" }), { status: 200 }),
    );

    const url = await getInstallUrl(
      githubConn({ externalId: null }),
      "a/b c?d",
    );

    expect(url).toContain("?state=a%2Fb%20c%3Fd");
  });

  it("throws when GitHub does not return a slug", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ name: "benisploy" }), { status: 200 }),
    );

    await expect(
      getInstallUrl(githubConn({ externalId: null }), "nonce-123"),
    ).rejects.toThrow("GitHub did not return an app slug");
  });

  it("throws for non-github_app connections", async () => {
    await expect(
      getInstallUrl(
        githubConn({
          authKind: "token",
          credentials: { token: "pat", username: "me" },
        }),
        "nonce-123",
      ),
    ).rejects.toThrow("GitHub adapter requires github_app credentials");
  });
});

describe("verifyInstallation", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("returns true when the installation exists", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 12345 }), { status: 200 }),
    );

    const result = await verifyInstallation(githubConn(), "12345");

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/app/installations/12345",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("returns false when the installation is not found", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Not Found" }), { status: 404 }),
    );

    const result = await verifyInstallation(githubConn(), "99999");

    expect(result).toBe(false);
  });
});

describe("parsePushEvent", () => {
  it("maps a valid branch push", () => {
    const headers = new Headers({
      "x-github-event": "push",
      "x-github-delivery": "delivery-1",
    });
    const body = JSON.stringify({
      ref: "refs/heads/main",
      after: "abcdef12345",
      head_commit: { message: "feat: thing" },
      repository: {
        full_name: "owner/repo",
        clone_url: "https://github.com/owner/repo.git",
      },
    });

    const result = githubProviderClient.parsePushEvent(
      githubConn(),
      headers,
      body,
    );

    expect(result).toEqual({
      repoSlug: "owner/repo",
      branch: "main",
      sha: "abcdef12345",
      message: "feat: thing",
      cloneUrl: "https://github.com/owner/repo.git",
      deliveryId: "delivery-1",
    });
  });

  it("returns null for a non-branch ref", () => {
    const headers = new Headers({ "x-github-event": "push" });
    const body = JSON.stringify({ ref: "refs/tags/v1.0.0", after: "abc" });
    expect(
      githubProviderClient.parsePushEvent(githubConn(), headers, body),
    ).toBeNull();
  });

  it("returns null for a non-push event", () => {
    const headers = new Headers({ "x-github-event": "ping" });
    const body = JSON.stringify({ ref: "refs/heads/main", after: "abc" });
    expect(
      githubProviderClient.parsePushEvent(githubConn(), headers, body),
    ).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    const headers = new Headers({ "x-github-event": "push" });
    const body = JSON.stringify({ ref: "refs/heads/main" });
    expect(
      githubProviderClient.parsePushEvent(githubConn(), headers, body),
    ).toBeNull();
  });
});

describe("verifyWebhookSignature", () => {
  it("accepts a valid HMAC signature", () => {
    const body = '{"ref":"refs/heads/main"}';
    const signature = `sha256=${createHmac("sha256", "webhook-secret")
      .update(body)
      .digest("hex")}`;
    const headers = new Headers({ "x-hub-signature-256": signature });

    expect(
      githubProviderClient.verifyWebhookSignature(githubConn(), headers, body),
    ).toBe(true);
  });

  it("rejects an incorrect signature", () => {
    const body = '{"ref":"refs/heads/main"}';
    const headers = new Headers({
      "x-hub-signature-256": `sha256=${"0".repeat(64)}`,
    });

    expect(
      githubProviderClient.verifyWebhookSignature(githubConn(), headers, body),
    ).toBe(false);
  });

  it("rejects when the header is missing", () => {
    expect(
      githubProviderClient.verifyWebhookSignature(
        githubConn(),
        new Headers(),
        "{}",
      ),
    ).toBe(false);
  });
});

describe("verifyConnection", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("returns the GitHub App name", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ name: "benisploy", slug: "benisploy" }), {
        status: 200,
      }),
    );

    const result = await githubProviderClient.verifyConnection(githubConn());

    expect(result.accountName).toBe("benisploy");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/app",
      expect.objectContaining({ method: "GET" }),
    );
  });
});

describe("listRepositories", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("exchanges an installation token and maps repositories", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "inst-token" }), { status: 201 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            repositories: [
              {
                full_name: "owner/repo",
                default_branch: "main",
                clone_url: "https://github.com/owner/repo.git",
                private: false,
              },
            ],
          }),
          { status: 200 },
        ),
      );

    const repos = await githubProviderClient.listRepositories(githubConn());

    expect(repos).toEqual([
      {
        slug: "owner/repo",
        defaultBranch: "main",
        cloneUrl: "https://github.com/owner/repo.git",
        isPrivate: false,
      },
    ]);
  });
});
