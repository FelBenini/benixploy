import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { app } from "$lib/server/app";

interface ManifestConversion {
  id?: number;
  slug?: string;
  client_id?: string;
  pem?: string;
  webhook_secret?: string | null;
  name?: string;
}

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.session || !locals.orgId) {
    throw redirect(302, "/login");
  }

  const code = url.searchParams.get("code");
  if (!code) {
    throw redirect(302, "/git-sources?error=manifest_failed");
  }

  const res = await fetch(
    `https://api.github.com/app-manifests/${code}/conversions`,
    {
      method: "POST",
      headers: { Accept: "application/vnd.github+json" },
    },
  ).catch(() => null);

  if (!res) {
    throw redirect(302, "/git-sources?error=manifest_failed");
  }
  if (!res.ok) {
    throw redirect(302, "/git-sources?error=manifest_expired");
  }

  const created = (await res.json()) as ManifestConversion;
  const { id, client_id, pem } = created;
  if (!id || !client_id || !pem) {
    throw redirect(302, "/git-sources?error=manifest_failed");
  }

  const connection = await app.repo.gitConnections.upsertGitConnection(
    locals.orgId,
    {
      authKind: "github_app",
      provider: "github",
      name: created.name ?? "GitHub App",
      baseUrl: "https://github.com",
      credentials: {
        appId: String(id),
        clientId: client_id,
        privateKeyPem: pem,
      },
      webhookSecret: created.webhook_secret ?? crypto.randomUUID(),
    },
  );

  throw redirect(302, `/git-sources/new?step=install&id=${connection.id}`);
};
