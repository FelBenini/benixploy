import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { app } from "$lib/server/app";

export const POST: RequestHandler = async ({ request, params }) => {
  const rawBody = await request.text();
  const result = await app.useCases.handleWebhook(
    params.connectionId,
    request.headers,
    rawBody,
  );
  console.log(result);

  return result.body === undefined
    ? new Response(null, { status: result.status })
    : json(result.body, { status: result.status });
};
