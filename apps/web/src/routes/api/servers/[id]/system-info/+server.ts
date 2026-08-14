import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { app } from "$lib/server/app";
import {
  connectForProvisioning,
  executeCommandWithStdin,
  createTofuHostVerifier,
} from "$lib/server/adapters/node-ssh/ssh-provision-client";

export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.session || !locals.orgId) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const server = await app.repo.servers.get(locals.orgId, params.id);
  if (!server) {
    return json({ error: "Server not found" }, { status: 404 });
  }

  const verifier = createTofuHostVerifier(server.hostKeyFingerprint);

  let client;
  try {
    client = await connectForProvisioning(
      {
        host: server.address,
        port: server.sshPort,
        username: server.sshUser,
        credentials: { type: "key", privateKey: server.sshPrivateKey },
      },
      verifier.verify,
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "SSH connection failed";
    return json({ error: message }, { status: 502 });
  }

  try {
    const result = await executeCommandWithStdin(
      client,
      "",
      "system_info\n",
      10_000,
    );

    const stdout = result.stdout.trim();
    const parsed = JSON.parse(stdout);

    if (parsed.action !== "system_info") {
      throw new Error("Invalid response from server");
    }

    return json({
      data: {
        os: parsed.os,
        arch: parsed.arch,
        ramBytes: parsed.ramBytes,
        distro: parsed.distro,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch system info";
    return json({ error: message }, { status: 502 });
  } finally {
    client.end();
  }
};
