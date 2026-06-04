import { Queue } from "bullmq";
import { QUEUE_NAMES } from "@synthetic/shared";
import { getMeter, runWithSpan } from "@synthetic/telemetry";
import { env } from "../config.js";

const connection = { url: env.REDIS_URL };
const meter = getMeter("synthetic.api.queue");
const queueEnqueueCount = meter.createCounter("synthetic.queue.enqueue.count", {
  description: "Total enqueued jobs by queue"
});

export const simulationRunsQueue = new Queue(QUEUE_NAMES.simulationRuns, { connection });
export const agentJobsQueue = new Queue(QUEUE_NAMES.agentJobs, { connection });
export const reportJobsQueue = new Queue(QUEUE_NAMES.reportJobs, { connection });

export async function enqueueSimulationRun(runId: string): Promise<void> {
  await runWithSpan(
    "queue.enqueue simulation-run",
    {
      attributes: {
        "queue.name": simulationRunsQueue.name,
        "job.name": "orchestrate-run",
        "simulation.run_id": runId
      }
    },
    async () => {
      await simulationRunsQueue.add(
        "orchestrate-run",
        { runId },
        {
          jobId: `simulation-run-${runId}`,
          removeOnComplete: true,
          removeOnFail: 200
        }
      );
      queueEnqueueCount.add(1, { "queue.name": simulationRunsQueue.name, "job.name": "orchestrate-run" });
    }
  );
}

export async function enqueueAgentJob(input: { runId: string; agentId: string }): Promise<void> {
  await runWithSpan(
    "queue.enqueue agent",
    {
      attributes: {
        "queue.name": agentJobsQueue.name,
        "job.name": "run-agent",
        "simulation.run_id": input.runId,
        "simulation.agent_id": input.agentId
      }
    },
    async () => {
      await agentJobsQueue.add(
        "run-agent",
        { runId: input.runId, agentId: input.agentId },
        {
          jobId: `agent-${input.agentId}`,
          removeOnComplete: true,
          removeOnFail: 200,
          attempts: 3,
          backoff: { type: "exponential", delay: 1500 }
        }
      );
      queueEnqueueCount.add(1, { "queue.name": agentJobsQueue.name, "job.name": "run-agent" });
    }
  );
}

export async function cancelRunJobs(runId: string): Promise<void> {
  const simulationJob = await simulationRunsQueue.getJob(`simulation-run-${runId}`);
  if (simulationJob) await simulationJob.remove();

  const waiting = await agentJobsQueue.getJobs(["waiting", "delayed", "prioritized"]);
  for (const job of waiting) {
    if ((job.data as { runId?: string }).runId === runId) {
      await job.remove();
    }
  }
}
