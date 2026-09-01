import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { app } from "$lib/server/app";

function buildManifest(origin: string): Record<string, unknown> {
  return {
    name: "benisploy",

    url: origin,

    hook_attributes: {
      url: `${origin}/api/git/events`,
      active: false,
    },

    // Used after the App itself is created from the manifest.
    redirect_url: `${origin}/api/git/github/manifest-callback`,

    // Used after the App is installed.
    setup_url: `${origin}/api/git/github/callback`,
    setup_on_update: true,

    public: false,

    default_permissions: {
      contents: "read",
      metadata: "read",
    },

    default_events: ["push"],

    request_oauth_on_install: false,
  };
}

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.session || !locals.orgId) {
    throw redirect(302, "/login");
  }

  // Bind an anti-forgery state to this user's session/organization. GitHub
  // does not echo state on manifest callbacks, so the server-side record IS
  // the state: manifest-callback consumes it before exchanging the code.
  await app.oauthStates.createManifestState(
    locals.session.userId,
    locals.orgId,
  );

  const manifest = JSON.stringify(buildManifest(url.origin));
  const manifestForScript = JSON.stringify(manifest);

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Redirecting to GitHub...</title>
</head>
<body>
  <p>Redirecting to GitHub...</p>
  <form id="github-manifest-form" method="POST" action="https://github.com/settings/apps/new">
    <input type="hidden" name="manifest" id="github-manifest" />
  </form>
  <script>
    document.getElementById("github-manifest").value = ${manifestForScript};
    document.getElementById("github-manifest-form").submit();
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
};
