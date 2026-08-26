import { createHmac, timingSafeEqual } from "crypto";
import type {
  CloneAuth,
  GitConnection,
  GitProviderClient,
  NormalizedPush,
  RepoRef,
} from "../../ports/git-provider-client";
import type { GitHubAppCredentials } from "../../domain/git-connection";
import { getAppJwt } from "./jwt";

const GITHUB_API = "https://api.github.com";
const ACCEPT_HEADER = "application/vnd.github+json";

function githubCredentials(conn: GitConnection): GitHubAppCredentials {
  if (conn.authKind !== "github_app") {
    throw new Error("GitHub adapter requires github_app credentials");
  }
  return conn.credentials as GitHubAppCredentials;
}

function apiBase(conn: GitConnection): string {
  const base = conn.baseUrl.replace(/\/+$/, "");
  if (base === "https://github.com") return GITHUB_API;
  return `${base}/api/v3`;
}

function cloneHost(conn: GitConnection): string {
  return conn.baseUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

async function requestJson(
  url: string,
  init: RequestInit,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: ACCEPT_HEADER,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const message =
      typeof body === "object" && body !== null && "message" in body
        ? String((body as { message: unknown }).message)
        : `GitHub API ${res.status}`;
    throw new Error(message);
  }

  return { status: res.status, body };
}

function installationId(conn: GitConnection): number {
  if (!conn.externalId) {
    throw new Error(
      "Connection has no installation_id — install the App first",
    );
  }
  const id = Number(conn.externalId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Invalid installation_id");
  }
  return id;
}

async function getInstallationToken(conn: GitConnection): Promise<string> {
  const creds = githubCredentials(conn);
  const jwt = getAppJwt(creds.privateKeyPem, creds.appId);
  const id = installationId(conn);

  const { body } = await requestJson(
    `${apiBase(conn)}/app/installations/${id}/access_tokens`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
    },
  );

  const token = (body as { token?: string }).token;
  if (!token) {
    throw new Error("GitHub did not return an installation token");
  }
  return token;
}

export async function verifyInstallation(
  conn: GitConnection,
  installationId: string,
): Promise<boolean> {
  const creds = githubCredentials(conn);
  const jwt = getAppJwt(creds.privateKeyPem, creds.appId);
  try {
    await requestJson(`${apiBase(conn)}/app/installations/${installationId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${jwt}` },
    });
    return true;
  } catch {
    return false;
  }
}

export async function getInstallUrl(conn: GitConnection): Promise<string> {
  const creds = githubCredentials(conn);
  const jwt = getAppJwt(creds.privateKeyPem, creds.appId);

  const { body } = await requestJson(`${apiBase(conn)}/app`, {
    method: "GET",
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const slug = (body as { slug?: string }).slug;
  if (!slug) {
    throw new Error("GitHub did not return an app slug");
  }

  const state = encodeURIComponent(conn.id);
  return `https://github.com/apps/${slug}/installations/new?state=${state}`;
}

export const githubProviderClient: GitProviderClient = {
  provider: "github",

  async verifyConnection(conn: GitConnection) {
    const creds = githubCredentials(conn);
    const jwt = getAppJwt(creds.privateKeyPem, creds.appId);

    const { body } = await requestJson(`${apiBase(conn)}/app`, {
      method: "GET",
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const name = (body as { name?: string }).name ?? "GitHub App";
    return { accountName: name };
  },

  async listRepositories(conn: GitConnection): Promise<RepoRef[]> {
    const token = await getInstallationToken(conn);
    const { body } = await requestJson(
      `${apiBase(conn)}/installation/repositories`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const repos = (body as { repositories?: unknown[] }).repositories ?? [];
    return repos.map((repo) => {
      const r = repo as {
        full_name?: string;
        default_branch?: string;
        clone_url?: string;
        private?: boolean;
      };
      return {
        slug: r.full_name ?? "",
        defaultBranch: r.default_branch ?? "main",
        cloneUrl: r.clone_url ?? "",
        isPrivate: r.private ?? false,
      };
    });
  },

  async getFileContent(
    conn: GitConnection,
    repoSlug: string,
    path: string,
    ref?: string,
  ): Promise<string | null> {
    const token = await getInstallationToken(conn);
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";

    const { status, body } = await requestJson(
      `${apiBase(conn)}/repos/${repoSlug}/contents/${path}${query}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (status === 404) return null;
    if (Array.isArray(body)) return null;

    const content = (body as { content?: string }).content;
    if (!content) return null;
    return Buffer.from(content, "base64").toString("utf8");
  },

  async getHeadSha(
    conn: GitConnection,
    repoSlug: string,
    branch: string,
  ): Promise<string> {
    const token = await getInstallationToken(conn);

    const { body } = await requestJson(
      `${apiBase(conn)}/repos/${repoSlug}/branches/${encodeURIComponent(branch)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    const sha = (body as { commit?: { sha?: string } }).commit?.sha;
    if (!sha) {
      throw new Error(`Branch '${branch}' not found for ${repoSlug}`);
    }
    return sha;
  },

  async resolveCloneAuth(
    conn: GitConnection,
    repoSlug: string,
  ): Promise<CloneAuth> {
    const token = await getInstallationToken(conn);
    return {
      url: `https://x-access-token:${token}@${cloneHost(conn)}/${repoSlug}.git`,
    };
  },

  verifyWebhookSignature(
    conn: GitConnection,
    headers: Headers,
    rawBody: string,
  ): boolean {
    const signature = headers.get("x-hub-signature-256");
    if (!signature) return false;

    const expected = `sha256=${createHmac("sha256", conn.webhookSecret)
      .update(rawBody)
      .digest("hex")}`;

    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  },

  parsePushEvent(
    conn: GitConnection,
    headers: Headers,
    rawBody: string,
  ): NormalizedPush | null {
    if (headers.get("x-github-event") !== "push") return null;

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return null;
    }

    const ref = payload.ref;
    if (typeof ref !== "string" || !ref.startsWith("refs/heads/")) {
      return null;
    }

    const repo = payload.repository as
      { full_name?: string; clone_url?: string } | undefined;
    const repoSlug = repo?.full_name;
    const sha = payload.after;
    if (!repoSlug || typeof sha !== "string") return null;

    const headCommit = payload.head_commit as { message?: string } | null;
    return {
      repoSlug,
      branch: ref.slice("refs/heads/".length),
      sha,
      message: headCommit?.message ?? "",
      cloneUrl: repo?.clone_url ?? `https://github.com/${repoSlug}.git`,
      deliveryId: headers.get("x-github-delivery") ?? "",
    };
  },
};
