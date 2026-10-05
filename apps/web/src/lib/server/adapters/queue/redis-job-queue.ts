import type { Redis } from "ioredis";
import type {
  DeployJob,
  DeployJobHandler,
  EnqueueResult,
  JobQueue,
} from "../../ports/job-queue";

const QUEUE_KEY = "deploy:queue";
const INFLIGHT_PREFIX = "deploy:inflight:";
const DEFAULT_TTL_SECONDS = 10 * 60;
const BLOCK_SECONDS = 5;

function inflightKey(appId: string): string {
  return `${INFLIGHT_PREFIX}${appId}`;
}

// ponytail: single consumer, no retry, no dead-letter. Redis list + an inflight
// key with TTL. Upgrade to RabbitMQ when you need multi-consumer fan-out,
// guaranteed delivery, or per-job retry semantics. A crash mid-job loses that
// job (the next push resolves it) — same trade-off the MVP accepts.
export class RedisJobQueue implements JobQueue {
  private readonly consumer: Redis;
  private stopping = false;
  private loop: Promise<void> | null = null;

  constructor(
    private readonly redis: Redis,
    private readonly ttlSeconds = DEFAULT_TTL_SECONDS,
  ) {
    // BRPOP blocks the connection, so the consumer gets its own; the shared
    // client stays free for oauth state and enqueue writes.
    this.consumer = redis.duplicate();
    this.consumer.on("error", (err) => {
      console.error("redis job queue consumer error:", err.message);
    });
  }

  async enqueue(job: DeployJob): Promise<EnqueueResult> {
    const acquired = await this.redis.set(
      inflightKey(job.appId),
      job.pushEventId,
      "EX",
      this.ttlSeconds,
      "NX",
    );
    if (acquired === null) {
      return { queued: false, reason: "in-flight" };
    }
    await this.redis.lpush(QUEUE_KEY, JSON.stringify(job));
    return { queued: true };
  }

  start(handler: DeployJobHandler): void {
    if (this.loop) return;
    this.stopping = false;
    this.loop = this.run(handler);
  }

  private async run(handler: DeployJobHandler): Promise<void> {
    while (!this.stopping) {
      let popped: [string, string] | null = null;
      try {
        popped = await this.consumer.brpop(QUEUE_KEY, BLOCK_SECONDS);
      } catch (err) {
        if (this.stopping) break;
        console.error("job queue brpop failed:", err);
        continue;
      }
      if (!popped) continue;

      const job = JSON.parse(popped[1]) as DeployJob;
      try {
        await handler(job);
      } catch (err) {
        console.error(`deploy job failed for app ${job.appId}:`, err);
      } finally {
        await this.redis.del(inflightKey(job.appId)).catch(() => { });
      }
    }
    this.loop = null;
  }

  async stop(): Promise<void> {
    this.stopping = true;
    await this.loop;
    this.consumer.disconnect();
  }
}
