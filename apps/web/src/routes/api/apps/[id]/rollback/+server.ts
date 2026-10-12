import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { app } from "$lib/server/app";

export const POST: RequestHandler = async ({ params, locals }) => {
  if (!locals.session || !locals.orgId) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await app.useCases.rollbackApp(
      locals.orgId,
      params.id,
      locals.user?.id,
    );
    return json({
      data: {
        app: result.app,
        strategy: result.strategy,
        targetVersion: result.targetVersion,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Rollback failed";
    return json({ error: message }, { status: 500 });
  }
};
