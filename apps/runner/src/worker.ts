import { Worker } from "bullmq";
import { ArtifactRepository, RunRepository, TestAccountRepository } from "@synthetic/database";
import { env } from "./lib/config.js";
import { RunnerApiClient } from "./lib/api-client.js";
import {
  agentJobsQueue,
  redisConnection,
  reportJobsQueue,
  simulationRunsQueue,
  type AgentJob,
  type ReportJob,
  type SimulationRunJob
} from "./queue/queues.js";
import { AccountReservationService } from "./services/account-reservation-service.js";
import { AgentJobProcessor } from "./services/agent-job-processor.js";
import { EventEmitterService } from "./services/event-emitter-service.js";
import { RunReportService } from "./services/run-report-service.js";
import { RunOrchestrator } from "./services/run-orchestrator.js";

const api = new RunnerApiClient();
await api.login();

const runRepository = new RunRepository();
const testAccountRepository = new TestAccountRepository();
const artifactRepository = new ArtifactRepository();

const eventEmitter = new EventEmitterService(api);
const accountReservationService = new AccountReservationService(api);

const runOrchestrator = new RunOrchestrator(runRepository, eventEmitter);
const agentProcessor = new AgentJobProcessor(
  runRepository,
  testAccountRepository,
  artifactRepository,
  accountReservationService,
  eventEmitter
);
const runReportService = new RunReportService(runRepository, eventEmitter);

const simulationWorker = new Worker<SimulationRunJob>(
  simulationRunsQueue.name,
  async (job) => {
    await runOrchestrator.orchestrate(job.data.runId);
  },
  { connection: redisConnection, concurrency: 1 }
);

const agentWorker = new Worker<AgentJob>(
  agentJobsQueue.name,
  async (job) => {
    await agentProcessor.process(job.data);
  },
  { connection: redisConnection, concurrency: env.MAX_PARALLEL_AGENTS }
);

const reportWorker = new Worker<ReportJob>(
  reportJobsQueue.name,
  async (job) => {
    await runReportService.generate(job.data.runId);
  },
  { connection: redisConnection, concurrency: 1 }
);

for (const worker of [simulationWorker, agentWorker, reportWorker]) {
  worker.on("failed", (job, error) => {
    console.error(`[worker:${worker.name}] job ${job?.id} failed: ${error.message}`);
  });
}

console.log(`[worker] started with MAX_PARALLEL_AGENTS=${env.MAX_PARALLEL_AGENTS}`);
