import { Queue } from "bullmq";
import { QUEUE_NAMES } from "@synthetic/shared";
import { env } from "../config.js";

const connection = { url: env.REDIS_URL };

export const simulationRunsQueue = new Queue(QUEUE_NAMES.simulationRuns, { connection });
export const agentJobsQueue = new Queue(QUEUE_NAMES.agentJobs, { connection });
export const reportJobsQueue = new Queue(QUEUE_NAMES.reportJobs, { connection });

export async function enqueueSimulationRun(runId: string): Promise<void> {
  await simulationRunsQueue.add(
    "orchestrate-run",
    { runId },
    {
      jobId: `simulation-run:${runId}`,
      removeOnComplete: true,
      removeOnFail: 200
    }
  );
}

export async function enqueueAgentJob(input: { runId: string; agentId: string }): Promise<void> {
  await agentJobsQueue.add(
    "run-agent",
    { runId: input.runId, agentId: input.agentId },
    {
      jobId: `agent:${input.agentId}`,
      removeOnComplete: true,
      removeOnFail: 200,
      attempts: 3,
      backoff: { type: "exponential", delay: 1500 }
    }
  );
}

export async function cancelRunJobs(runId: string): Promise<void> {
  const simulationJob = await simulationRunsQueue.getJob(`simulation-run:${runId}`);
  if (simulationJob) await simulationJob.remove();

  const waiting = await agentJobsQueue.getJobs(["waiting", "delayed", "prioritized"]);
  for (const job of waiting) {
    if ((job.data as { runId?: string }).runId === runId) {
      await job.remove();
    }
  }
}
