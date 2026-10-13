import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { z } from "zod";
import { app } from "$lib/server/app";
import { getGitProvider } from "$lib/server/adapters/git";

const CreateGitAppSchema = z.object({
  serverId: z.string().min(1),
  connectionId: z.string().min(1),
  repoSlug: z.string().min(1),
  branch: z.string().min(1).optional(),
  name: z.string().min(1).max(64),
  port: z.number().int().positive().max(65535).default(80),
});

/**
 * Creates a stateless app from a repository: first blue deploy via the
 * manual flow, then attaches the git source so pushes drive the push-deploy
 * orchestrator.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.session || !locals.orgId) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateGitAppSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { serverId, connectionId, repoSlug, name, port } = parsed.data;

  const connection = await app.repo.gitConnections.findGitConnection(
    locals.orgId,
    connectionId,
  );
  if (!connection) {
    return json({ error: "Connection not found" }, { status: 404 });
  }

  let repo;
  try {
    const repos = await getGitProvider(connection.provider).listRepositories(
      connection,
    );
    repo = repos.find((r) => r.slug === repoSlug);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list repositories";
    return json({ error: message }, { status: 502 });
  }
  if (!repo) {
    return json(
      { error: `Repository not found: ${repoSlug}` },
      { status: 400 },
    );
  }

  const branch = parsed.data.branch ?? repo.defaultBranch;
  try {
    const result = await app.useCases.deployApp(
      locals.orgId,
      {
        kind: "stateless",
        name,
        buildContext: repo.cloneUrl,
        ports: [{ container: port, protocol: "tcp" }],
        volumeMounts: [],
        envVars: {},
      },
      serverId,
    );

    await app.repo.gitSources.upsert({
      appId: result.app.id,
      connectionId: connection.id,
      provider: connection.provider,
      repoSlug: repo.slug,
      cloneUrl: repo.cloneUrl,
      branch,
    });
    if (result.app.activeColor) {
      await app.repo.gitSources.setActiveColor(
        result.app.id,
        result.app.activeColor,
      );
    }

    return json({ data: result }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Deployment failed";
    return json({ error: message }, { status: 500 });
  }
};
