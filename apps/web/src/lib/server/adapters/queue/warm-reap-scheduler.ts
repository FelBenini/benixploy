import type { Redis } from "ioredis";
import { Queue, Worker } from "bullmq";
import { bullConnection } from "./redis-job-queue";

const REAP_INTERVAL_MS = 5 * 60 * 1000;
const QUEUE_NAME = "warm-reap";

/**
 * Scheduled warm-color sweep. A repeatable BullMQ job fires the reap handler
 * every `intervalMs`; with multiple app replicas, BullMQ guarantees only one
 * worker processes each tick, so warm colors are never reaped twice.
 */
export class WarmReapScheduler {
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  constructor(
    private readonly redis: Redis,
    private readonly reap: () => Promise<number>,
    private readonly intervalMs = REAP_INTERVAL_MS,
  ) {}

  async start(): Promise<void> {
    if (this.worker) return;
    this.queue = new Queue(QUEUE_NAME, {
      connection: bullConnection(this.redis),
    });
    this.worker = new Worker(
      QUEUE_NAME,
      async () => {
        try {
          await this.reap();
        } catch (err) {
          // The next tick retries; a sweep is idempotent.
          console.error("warm-reap job failed:", err);
        }
      },
      { connection: bullConnection(this.redis) },
    );
    this.worker.on("error", (err) => {
      console.error("warm-reap worker error:", err.message);
    });
    await this.queue.upsertJobScheduler("warm-reap", {
      every: this.intervalMs,
    });
  }

  async stop(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    this.worker = null;
    this.queue = null;
  }
}
