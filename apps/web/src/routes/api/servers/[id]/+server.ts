import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { app } from "$lib/server/app";
import {
  UpdateServerInputSchema,
  toPublicServer,
} from "$lib/server/domain/server";

export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.session || !locals.orgId) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const server = await app.repo.servers.get(locals.orgId, params.id);
  if (!server) {
    return json({ error: "Server not found" }, { status: 404 });
  }

  return json({ data: toPublicServer(server) });
};

export const PATCH: RequestHandler = async ({ request, locals, params }) => {
  if (!locals.session || !locals.orgId) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const server = await app.repo.servers.get(locals.orgId, params.id);
  if (!server) {
    return json({ error: "Server not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = UpdateServerInputSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const updated = await app.repo.servers.updateConnection(
    locals.orgId,
    params.id,
    parsed.data,
  );
  return json({ data: toPublicServer(updated) });
};
