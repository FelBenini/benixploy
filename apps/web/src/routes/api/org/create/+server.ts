import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { app } from "$lib/server/app";

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.session) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const name = body.name as string | undefined;
  const slug = body.slug as string | undefined;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return json({ error: "Name is required" }, { status: 400 });
  }

  if (!slug || typeof slug !== "string" || slug.trim().length === 0) {
    return json({ error: "Slug is required" }, { status: 400 });
  }

  const now = new Date();
  const orgId = crypto.randomUUID();

  const org = await app.repo.orgs.create(app.db, {
    id: orgId,
    name: name.trim(),
    slug: slug.trim().toLowerCase(),
    createdAt: now,
    updatedAt: now,
  });

  await app.repo.memberships.create(app.db, {
    userId: locals.session.userId,
    orgId: org.id,
    role: "owner",
    createdAt: now,
  });

  return json({
    id: org.id,
    name: org.name,
    slug: org.slug,
  });
};
