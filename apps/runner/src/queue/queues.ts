import { Queue } from "bullmq";
import { QUEUE_NAMES } from "@synthetic/shared";
import { env } from "../lib/config.js";

export const redisConnection = { url: env.REDIS_URL };

export const simulationRunsQueue = new Queue(QUEUE_NAMES.simulationRuns, { connection: redisConnection });
export const agentJobsQueue = new Queue(QUEUE_NAMES.agentJobs, { connection: redisConnection });
export const reportJobsQueue = new Queue(QUEUE_NAMES.reportJobs, { connection: redisConnection });

export type SimulationRunJob = { runId: string };
export type AgentJob = { runId: string; agentId: string };
export type ReportJob = { runId: string };

export async function enqueueReportJob(runId: string): Promise<void> {
  await reportJobsQueue.add(
    'generate-run-report',
    { runId },
    {
      jobId: `report-${runId}`,
      removeOnComplete: true,
      removeOnFail: 200,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1500 }
    }
  );
}
