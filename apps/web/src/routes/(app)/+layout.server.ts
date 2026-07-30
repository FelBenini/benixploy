import { redirect, type ServerLoadEvent } from "@sveltejs/kit";
import { encodeSessionPublicJSON } from "$lib/server/domain/session";

export const load = async ({ locals }: ServerLoadEvent) => {
  if (!locals.session) {
    throw redirect(302, "/login");
  }
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
  };
};
