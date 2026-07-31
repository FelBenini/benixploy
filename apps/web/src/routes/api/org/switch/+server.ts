import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { ACTIVE_ORG_COOKIE } from "../../../../hooks.server";
import { app } from "$lib/server/app";

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
  if (!locals.session) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const orgId = body.orgId as string | undefined;

  if (!orgId || typeof orgId !== "string") {
    return json({ error: "orgId is required" }, { status: 400 });
  }

  const memberships = await app.repo.memberships.findByUserIdAll(
    locals.session.userId,
  );
  const membershipOrgIds = memberships.map((m) => m.orgId);

  if (!membershipOrgIds.includes(orgId)) {
    return json({ error: "Not a member of this organization" }, { status: 403 });
  }

  cookies.set(ACTIVE_ORG_COOKIE, orgId, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  return json({ success: true });
};
