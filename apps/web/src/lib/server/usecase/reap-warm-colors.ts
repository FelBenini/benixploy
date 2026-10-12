import type { Repository } from "../ports/repository";
import type { NodeCommandClient } from "../ports/node-command-client";

/**
 * Stops warm colors whose retention window has expired and clears their
 * tracking row. Returns the number of colors reaped.
 *
 * shortcut: stopColor keeps the stopped container + image around; the node
 * forced-command has no per-color teardown action yet. Add one and call it
 * here when cold colors need disk reclaimed before the app is deleted.
 */
export function createReapWarmColors(
  repo: Repository,
  nodeClient: NodeCommandClient,
) {
  return async function reapWarmColors(now = new Date()): Promise<number> {
    const expired = await repo.gitSources.listExpiredWarm(now.toISOString());
    let reaped = 0;

    for (const source of expired) {
      if (!source.warmColor) continue;
      try {
        await nodeClient.stopColor(
          source.serverId,
          source.appId,
          source.warmColor,
        );
        await repo.gitSources.clearWarmColor(source.appId);
        reaped++;
      } catch (err) {
        console.error(`warm-color reap failed for app ${source.appId}:`, err);
      }
    }

    return reaped;
  };
}
