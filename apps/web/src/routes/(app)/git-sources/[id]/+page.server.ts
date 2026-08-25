import type { Actions } from "./$types";
import type { ServerLoad } from "@sveltejs/kit";
import { createHmac } from "crypto";
import { app } from "$lib/server/app";
import { getGitProvider } from "$lib/server/adapters/git";
import type {
  GitProviderClient,
  GitConnection,
} from "$lib/server/ports/git-provider-client";

type Outcome =
  | { ok: true; method: string; result: unknown }
  | { ok: false; method: string; error: string };

async function run(
  orgId: string | null,
  id: string,
  method: string,
  fn: (
    client: GitProviderClient,
    conn: GitConnection,
  ) => unknown | Promise<unknown>,
): Promise<Outcome> {
  if (!orgId) return { ok: false, method, error: "Unauthorized" };
  const conn = await app.repo.gitConnections.findGitConnection(orgId, id);
  if (!conn) return { ok: false, method, error: "Connection not found" };
  try {
    const client = getGitProvider(conn.provider);
    return { ok: true, method, result: await fn(client, conn) };
  } catch (err) {
    return {
      ok: false,
      method,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export const load: ServerLoad = async ({ params, locals }) => {
  if (!locals.orgId) return { connection: null };
  const connections = await app.repo.gitConnections.listGitConnections(
    locals.orgId,
  );
  const conn = connections.find((c) => c.id === params.id);
  if (!conn) return { connection: null };
  return {
    connection: {
      id: conn.id,
      provider: conn.provider,
      name: conn.name,
      baseUrl: conn.baseUrl,
      authKind: conn.authKind,
      externalId: conn.externalId ?? null,
    },
  };
};

export const actions: Actions = {
  verifyConnection: async ({ params, locals }) =>
    run(locals.orgId, params.id, "verifyConnection", (c, conn) =>
      c.verifyConnection(conn),
    ),

  listRepositories: async ({ params, locals }) =>
    run(locals.orgId, params.id, "listRepositories", (c, conn) =>
      c.listRepositories(conn),
    ),

  getFileContent: async ({ request, params, locals }) => {
    const data = await request.formData();
    const repoSlug = String(data.get("repoSlug") ?? "").trim();
    const path = String(data.get("path") ?? "").trim();
    const ref = String(data.get("ref") ?? "").trim();
    if (!repoSlug || !path) {
      return {
        ok: false,
        method: "getFileContent",
        error: "repoSlug and path are required",
      };
    }
    return run(locals.orgId, params.id, "getFileContent", (c, conn) =>
      c.getFileContent(conn, repoSlug, path, ref || undefined),
    );
  },

  getHeadSha: async ({ request, params, locals }) => {
    const data = await request.formData();
    const repoSlug = String(data.get("repoSlug") ?? "").trim();
    const branch = String(data.get("branch") ?? "").trim();
    if (!repoSlug || !branch) {
      return {
        ok: false,
        method: "getHeadSha",
        error: "repoSlug and branch are required",
      };
    }
    return run(locals.orgId, params.id, "getHeadSha", (c, conn) =>
      c.getHeadSha(conn, repoSlug, branch),
    );
  },

  resolveCloneAuth: async ({ request, params, locals }) => {
    const data = await request.formData();
    const repoSlug = String(data.get("repoSlug") ?? "").trim();
    if (!repoSlug) {
      return {
        ok: false,
        method: "resolveCloneAuth",
        error: "repoSlug is required",
      };
    }
    return run(locals.orgId, params.id, "resolveCloneAuth", async (c, conn) => {
      const cloneAuth = await c.resolveCloneAuth(conn, repoSlug);
      return {
        url: cloneAuth.url.replace(/(x-access-token:)[^@]+@/, "$1***@"),
        header: cloneAuth.header ? "***" : undefined,
      };
    });
  },

  verifyWebhookSignature: async ({ request, params, locals }) => {
    const data = await request.formData();
    const rawBody = String(data.get("rawBody") ?? "");
    const signature = String(data.get("signature") ?? "").trim();
    return run(locals.orgId, params.id, "verifyWebhookSignature", (c, conn) => {
      const sig =
        signature ||
        `sha256=${createHmac("sha256", conn.webhookSecret).update(rawBody).digest("hex")}`;
      const headers = new Headers({ "x-hub-signature-256": sig });
      const verified = c.verifyWebhookSignature(conn, headers, rawBody);
      return { verified, signature: sig };
    });
  },

  parsePushEvent: async ({ request, params, locals }) => {
    const data = await request.formData();
    const rawBody = String(data.get("rawBody") ?? "");
    const event = String(data.get("event") ?? "push").trim() || "push";
    return run(locals.orgId, params.id, "parsePushEvent", (c, conn) => {
      const headers = new Headers({
        "x-github-event": event,
        "x-github-delivery": "test-delivery",
      });
      return c.parsePushEvent(conn, headers, rawBody);
    });
  },
};
