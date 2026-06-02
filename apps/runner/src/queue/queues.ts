import { Queue } from "bullmq";
import { QUEUE_NAMES } from "@synthetic/shared";
import { env } from "../lib/config.js";

export const redisConnection = { url: env.REDIS_URL };

export const simulationRunsQueue = new Queue(QUEUE_NAMES.simulationRuns, { connection: redisConnection });
export const agentJobsQueue = new Queue(QUEUE_NAMES.agentJobs, { connection: redisConnection });
export const reportJobsQueue = new Queue(QUEUE_NAMES.reportJobs, { connection: redisConnection });

export type SimulationRunJob = { runId: string };
export type AgentJob = { runId: string; agentId: string };
