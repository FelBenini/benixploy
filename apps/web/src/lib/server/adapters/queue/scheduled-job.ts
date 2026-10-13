import type { Redis } from "ioredis";
import { Queue, Worker } from "bullmq";
import { bullConnection } from "./redis-job-queue";

/**
 * A recurring background job on a BullMQ repeatable scheduler. With multiple
 * app replicas, BullMQ guarantees only one worker processes each tick, so
 * the handler never runs twice per interval.
 */
export class ScheduledJob {
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  constructor(
    readonly name: string,
    private readonly redis: Redis,
    private readonly run: () => Promise<void>,
    private readonly intervalMs: number,
  ) {}

  async start(): Promise<void> {
    if (this.worker) return;
    this.queue = new Queue(this.name, {
      connection: bullConnection(this.redis),
    });
    this.worker = new Worker(
      this.name,
      async () => {
        try {
          await this.run();
        } catch (err) {
          // The next tick retries; scheduled jobs are idempotent sweeps.
          console.error(`${this.name} job failed:`, err);
        }
      },
      { connection: bullConnection(this.redis) },
    );
    this.worker.on("error", (err) => {
      console.error(`${this.name} worker error:`, err.message);
    });
    await this.queue.upsertJobScheduler(this.name, {
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
