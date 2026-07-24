import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { AnyMessageSchema } from "monitor-schemas";
import { app } from "$lib/server/app";

export const POST: RequestHandler = async ({ request }) => {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json(
      { error: "Missing or invalid Authorization header" },
      { status: 401 },
    );
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return json({ error: "Empty token" }, { status: 401 });
  }

  const server = await app.repo.servers.getByIdAny(token);
  if (!server) {
    return json({ error: "Unknown server" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = AnyMessageSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "Invalid message", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const msg = parsed.data;

  if (msg.type === "stats_push") {
    const s = msg.payload;
    await app.repo.nodeEvents.insertStats(server.id, {
      serverId: server.id,
      cpuPercent: s.cpuPercent,
      memoryTotal: s.memory.total,
      memoryUsed: s.memory.used,
      memoryAvailable: s.memory.available,
      diskTotal: s.disk.total,
      diskUsed: s.disk.used,
      uptime: s.uptime,
      containerCount: s.containerCount,
      containerStates: s.containerStates,
    });

    return json({ status: "ok" }, { status: 200 });
  }

  if (msg.type === "event_push") {
    const e = msg.payload;
    await app.repo.nodeEvents.insertEvent(
      server.id,
      e.eventType,
      msg.payload as unknown as Record<string, unknown>,
    );

    return json({ status: "ok" }, { status: 200 });
  }

  // AnyMessageSchema already narrowed the type; this case is unreachable
  // but required for exhaustiveness
  return json({ error: `Unhandled message type` }, { status: 400 });
};
