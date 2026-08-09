import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { app } from "$lib/server/app";
import { ProvisionServerInputSchema } from "$lib/server/domain/server";

export const POST: RequestHandler = async ({
  request,
  locals,
  params,
  url,
}) => {
  if (!locals.session || !locals.orgId) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ProvisionServerInputSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const server = await app.repo.servers.get(locals.orgId, params.id);
  if (!server) {
    return json({ error: "Server not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      }

      try {
        const provisioning = app.useCases.provisionServer(
          locals.orgId!,
          params.id,
          parsed.data,
          { controlPlaneUrl: url.origin },
        );

        for await (const event of provisioning) {
          if ("type" in event && event.type === "done") {
            send("done", { serverId: event.serverId });
          } else if ("type" in event && event.type === "error") {
            send("error", {
              phase: event.phase,
              message: event.message,
              ...(event.knownErrors ? { knownErrors: event.knownErrors } : {}),
            });
          } else if ("phase" in event) {
            send("phase", event);
          }
        }
      } catch (err) {
        send("error", {
          phase: -1,
          message: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};
