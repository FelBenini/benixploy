import type { Handle } from "@sveltejs/kit";
import { app } from "$lib/server/app";
import { SESSION_COOKIE } from "$lib/server/auth/session";

export const ACTIVE_ORG_COOKIE = "active_org_id";

export const handle: Handle = async ({ event, resolve }) => {
  // CSRF protection
  if (event.request.method !== "GET" && event.request.method !== "HEAD") {
    const origin = event.request.headers.get("Origin");
    const host = event.request.headers.get("Host");
    if (!origin || !host) {
      return new Response("Forbidden", { status: 403 });
    }
    try {
      const originUrl = new URL(origin);
      if (originUrl.host !== host) {
        return new Response("Forbidden", { status: 403 });
      }
    } catch {
      return new Response("Forbidden", { status: 403 });
    }
  }

  // Session validation + org resolution
  const token = event.cookies.get(SESSION_COOKIE);

  if (token) {
    const session = await app.auth.validateSessionToken(token);
    if (session) {
      event.locals.session = session;
      event.locals.user = await app.repo.users.getByUserId(session.userId);

      const memberships = await app.repo.memberships.findByUserIdAll(
        session.userId,
      );
      const membershipOrgIds = memberships.map((m) => m.orgId);

      const activeOrgId = event.cookies.get(ACTIVE_ORG_COOKIE);
      if (
        activeOrgId &&
        membershipOrgIds.includes(activeOrgId)
      ) {
        event.locals.orgId = activeOrgId;
      } else if (membershipOrgIds.length > 0) {
        event.locals.orgId = membershipOrgIds[0];
      } else {
        event.locals.orgId = null;
      }
    } else {
      event.locals.session = null;
      event.locals.orgId = null;
      event.cookies.delete(SESSION_COOKIE, {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
      });
      event.cookies.delete(ACTIVE_ORG_COOKIE, {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
      });
    }
  } else {
    event.locals.session = null;
    event.locals.orgId = null;
  }

  const response = await resolve(event);
  return response;
};
