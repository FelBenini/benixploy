import type { Redis } from "ioredis";
import type {
  DeployJob,
  DeployJobHandler,
  EnqueueResult,
  JobQueue,
} from "../../ports/job-queue";
import { Queue, Worker } from "bullmq";

const QUEUE_NAME = "deploy";
// Colons are forbidden in BullMQ custom job ids, so the per-app key is
// a plain prefix, not the historical "deploy:app" Redis key.
const JOB_PREFIX = "deploy-";

/**
 * BullMQ connection options derived from a shared ioredis instance. Each
 * Queue/Worker gets its own connection (BullMQ blocks on workers), so options
 * are passed, never the live client.
 */
export function bullConnection(redis: Redis) {
  return {
    host: redis.options.host,
    port: redis.options.port,
    password: redis.options.password,
    db: redis.options.db,
    maxRetriesPerRequest: null,
  };
}

function jobKey(appId: string): string {
  return `${JOB_PREFIX}${appId}`;
}

/**
 * Deploy queue backed by BullMQ. One in-flight job per app: the jobId is
 * derived from the app, so a second enqueue for the same app finds the queued
 * job and is dropped — the same semantics as the old hand-rolled inflight
 * lock, but without the TTL escape hatch (a job holds its app until it
 * finishes or fails).
 */
export class RedisJobQueue implements JobQueue {
  private readonly queue: Queue;
  private worker: Worker | null = null;

  constructor(private readonly redis: Redis) {
    this.queue = new Queue(QUEUE_NAME, {
      connection: bullConnection(redis),
    });
  }

  async enqueue(job: DeployJob): Promise<EnqueueResult> {
    const jobId = jobKey(job.appId);
    // Best-effort in-flight check; the jobId dedup in `add` is the hard
    // guarantee. A concurrent enqueue may slip past the check and report
    // queued, but BullMQ still runs only one job for the app.
    if (await this.queue.getJob(jobId)) {
      return { queued: false, reason: "in-flight" };
    }
    await this.queue.add("deploy", job, {
      jobId,
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: true,
    });
    return { queued: true };
  }

  start(handler: DeployJobHandler): void {
    if (this.worker) return;
    this.worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        try {
          await handler(job.data as DeployJob);
        } catch (err) {
          // Match the old consumer loop: log, never retry, release the job.
          console.error(
            `deploy job failed for app ${(job.data as DeployJob).appId}:`,
            err,
          );
        }
      },
      { connection: bullConnection(this.redis) },
    );
    this.worker.on("error", (err) => {
      console.error("redis job queue worker error:", err.message);
    });
  }

  async stop(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    this.worker = null;
  }
}
