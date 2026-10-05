import type { PushEventRepository } from "../ports/repository";
import type { DeployJobHandler } from "../ports/job-queue";

export function createStubDeployJobHandler(
  pushEvents: PushEventRepository,
): DeployJobHandler {
  return async (job) => {
    console.log(`[deploy-job] stub: app=${job.appId} sha=${job.sha}`);
    await pushEvents.updateStatus(job.pushEventId, "deploying");
    await pushEvents.updateStatus(job.pushEventId, "success");
  };
}
