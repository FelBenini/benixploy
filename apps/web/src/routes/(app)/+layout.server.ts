import { redirect, type ServerLoadEvent } from "@sveltejs/kit";
import { encodeSessionPublicJSON } from "$lib/server/domain/session";
import { app } from "$lib/server/app";

export const load = async ({ locals, url }: ServerLoadEvent) => {
  if (!locals.session) {
    throw redirect(302, "/login");
  }

  const memberships = await app.repo.memberships.findByUserIdAll(
    locals.session.userId,
  );
  const orgIds = memberships.map((m) => m.orgId);
  const orgs = await app.repo.orgs.listByIds(orgIds);
  const activeOrg = orgs.find((o) => o.id === locals.orgId) ?? null;

  return {
    session: JSON.parse(encodeSessionPublicJSON(locals.session)),
    user: locals.user
      ? {
          id: locals.user.id,
          email: locals.user.email,
          username: locals.user.username,
          avatarUrl: locals.user.avatarUrl,
        }
      : null,
    activeOrg: activeOrg
      ? {
          id: activeOrg.id,
          name: activeOrg.name,
          slug: activeOrg.slug,
        }
      : null,
    userOrgs: orgs.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
    })),
    url,
  };
};
