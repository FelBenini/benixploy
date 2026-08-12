import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dev } from "$app/environment";
import type { RequestHandler } from "./$types";

const SUPPORTED_ARCHES = ["amd64", "arm64", "armv7"] as const;
type Arch = (typeof SUPPORTED_ARCHES)[number];

function resolveBinaryDir(): string {
  if (process.env.NODE_MONITOR_BIN_DIR) {
    return process.env.NODE_MONITOR_BIN_DIR;
  }
  if (dev) {
    return join(process.cwd(), "static", "node-monitor");
  }
  return join(process.cwd(), "client", "node-monitor");
}

export const GET: RequestHandler = async ({ url }) => {
  const arch = url.searchParams.get("arch");

  if (!arch || !SUPPORTED_ARCHES.includes(arch as Arch)) {
    return new Response(
      "Invalid or missing arch. Supported: amd64, arm64, armv7",
      {
        status: 400,
      },
    );
  }

  const filePath = join(resolveBinaryDir(), `node-monitor-${arch}`);

  let binary: ArrayBuffer;
  try {
    const file = readFileSync(filePath);
    binary = file.buffer.slice(
      file.byteOffset,
      file.byteOffset + file.byteLength,
    ) as ArrayBuffer;
  } catch {
    return new Response("Binary not found for arch", { status: 404 });
  }

  return new Response(binary, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="node-monitor"',
      "Content-Length": String(binary.byteLength),
      "Cache-Control": "public, max-age=3600",
    },
  });
};
