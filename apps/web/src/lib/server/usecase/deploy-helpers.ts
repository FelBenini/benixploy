import type { NodeCommandClient } from "../ports/node-command-client";

export const VERIFY_POLL_INTERVAL_MS = 2_000;

/**
 * Poll `color-status` until a container for the color reports running and
 * healthy, or the timeout elapses. A container without a healthcheck reports
 * no health status — running is the best signal available for those.
 */
export async function waitForHealthy(
  nodeClient: NodeCommandClient,
  serverId: string,
  appId: string,
  color: "blue" | "green",
  timeoutMs: number,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const states = await nodeClient.colorStatus(serverId, appId, color);
    const healthy = states.some(
      (s) =>
        s.state === "running" &&
        (s.health === "healthy" || s.health === undefined),
    );
    if (healthy) return true;
    await new Promise((r) => setTimeout(r, VERIFY_POLL_INTERVAL_MS));
  }
  return false;
}
