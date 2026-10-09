export interface DeployJob {
  appId: string;
  pushEventId: string;
  sha: string;
  repoSlug: string;
  branch: string;
  cloneUrl: string;
  connectionId: string;
}

export type DeployJobHandler = (job: DeployJob) => Promise<void>;

export interface EnqueueResult {
  queued: boolean;
  reason?: "in-flight";
}

export interface JobQueue {
  enqueue(job: DeployJob): Promise<EnqueueResult>;
  start(handler: DeployJobHandler): void;
  stop(): Promise<void>;
}
