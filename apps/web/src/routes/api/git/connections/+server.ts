import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { UpsertGitConnectionInputSchema } from "$lib/server/domain/git-connection";
import { app } from "$lib/server/app";

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.session || !locals.orgId) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const connections = await app.repo.gitConnections.listGitConnections(
    locals.orgId,
  );
  return json({ data: connections });
};

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

  const parsed = UpsertGitConnectionInputSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const connection = await app.repo.gitConnections.upsertGitConnection(
    locals.orgId,
    parsed.data,
  );
  return json({ data: connection }, { status: 201 });
};
