import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { AnyMessageSchema } from "monitor-schemas";
import { app } from "$lib/server/app";

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  return token || null;
}

export const POST: RequestHandler = async ({ request }) => {
  const token = extractBearerToken(request.headers.get("Authorization"));
  if (!token) {
    return json(
      { error: "Missing or invalid Authorization header" },
      { status: 401 },
    );
  }

  const node = await app.repo.registeredNodes.getByBearerToken(token);
  if (!node || node.status !== "active") {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const serverId = node.serverId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = AnyMessageSchema.safeParse(body);
  if (!parsed.success) {
    console.log(parsed.error)
    return json(
      { error: "Invalid message", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const msg = parsed.data;

  if (msg.type === "stats_push") {
    const s = msg.payload;
    await Promise.all([
      app.repo.nodeEvents.insertStats(serverId, {
        serverId,
        cpuPercent: s.cpuPercent,
        memoryTotal: s.memory.total,
        memoryUsed: s.memory.used,
        memoryAvailable: s.memory.available,
        diskTotal: s.disk.total,
        diskUsed: s.disk.used,
        uptime: s.uptime,
        containerCount: s.containerCount,
        containerStates: s.containerStates,
      }),
      app.repo.servers.touchHeartbeat(serverId),
    ]);

    return json({ status: "ok" }, { status: 202 });
  }

  if (msg.type === "event_push") {
    const e = msg.payload;
    await Promise.all([
      app.repo.nodeEvents.insertEvent(
        serverId,
        e.eventType,
        msg.payload as unknown as Record<string, unknown>,
        e.appId,
      ),
      app.repo.servers.touchHeartbeat(serverId),
    ]);

    return json({ status: "ok" }, { status: 202 });
  }

  if (msg.type === "heartbeat") {
    await app.repo.servers.touchHeartbeat(serverId);

    return json({ status: "ok" }, { status: 202 });
  }

  return json({ error: "Unhandled message type" }, { status: 400 });
};
