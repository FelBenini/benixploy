import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { app } from "$lib/server/app";

const RANGES: Record<string, number> = {
  "5m": 5 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

export const GET: RequestHandler = async ({ locals, params, url }) => {
  if (!locals.session || !locals.orgId) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const server = await app.repo.servers.get(locals.orgId, params.id);
  if (!server) {
    return json({ error: "Server not found" }, { status: 404 });
  }

  const range = url.searchParams.get("range") ?? "24h";
  const rangeMs = RANGES[range];
  if (!rangeMs) {
    return json(
      { error: "Invalid range. Supported: 1h, 24h, 7d" },
      { status: 400 },
    );
  }

  const since = new Date(Date.now() - rangeMs).toISOString();

  const [stats, events] = await Promise.all([
    app.repo.nodeEvents.getRecentStats(params.id, 1000, since),
    app.repo.nodeEvents.getRecentEvents(params.id, 100, since),
  ]);

  return json({ data: { stats, events } });
};
