import { Worker } from "bullmq";
import { SpanStatusCode, type Span } from "@opentelemetry/api";
import { ArtifactRepository, RunRepository, TestAccountRepository } from "@synthetic/database";
import { getMeter, initializeTelemetry, runWithSpan, shutdownTelemetry } from "@synthetic/telemetry";
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

initializeTelemetry({
  serviceName: "synthetic-runner",
  serviceVersion: "0.1.0",
  serviceNamespace: "synthetic-platform",
  enabled: env.OTEL_ENABLED,
  consoleExportEnabled: env.OTEL_CONSOLE_EXPORT_ENABLED,
  metricExportIntervalMs: env.OTEL_METRIC_EXPORT_INTERVAL_MS
});

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
const meter = getMeter("synthetic.runner.queue");
const queueDurationMs = meter.createHistogram("synthetic.queue.duration", {
  description: "Time jobs spend queued before processing",
  unit: "ms"
});
const jobDurationMs = meter.createHistogram("synthetic.job.duration", {
  description: "Time spent processing queue jobs",
  unit: "ms"
});

const simulationWorker = new Worker<SimulationRunJob>(
  simulationRunsQueue.name,
  async (job) => {
    await instrumentJob(job, async () => {
      await runOrchestrator.orchestrate(job.data.runId);
    });
  },
  { connection: redisConnection, concurrency: 1 }
);

const agentWorker = new Worker<AgentJob>(
  agentJobsQueue.name,
  async (job) => {
    await instrumentJob(job, async () => {
      await agentProcessor.process(job.data);
    });
  },
  { connection: redisConnection, concurrency: env.MAX_PARALLEL_AGENTS }
);

const reportWorker = new Worker<ReportJob>(
  reportJobsQueue.name,
  async (job) => {
    await instrumentJob(job, async () => {
      await runReportService.generate(job.data.runId);
    });
  },
  { connection: redisConnection, concurrency: 1 }
);

for (const worker of [simulationWorker, agentWorker, reportWorker]) {
  worker.on("failed", (job, error) => {
    console.error(`[worker:${worker.name}] job ${job?.id} failed: ${error.message}`);
  });
}

console.log(`[worker] started with MAX_PARALLEL_AGENTS=${env.MAX_PARALLEL_AGENTS}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void shutdownTelemetry().finally(() => process.exit(0));
  });
}

async function instrumentJob(
  job: { name: string; queueName: string; timestamp: number; data: Record<string, unknown> },
  callback: () => Promise<void>
): Promise<void> {
  const queuedMs = Math.max(0, Date.now() - job.timestamp);
  queueDurationMs.record(queuedMs, { "queue.name": job.queueName, "job.name": job.name });

  const startedAt = Date.now();
  await runWithSpan(
    `worker.${job.queueName}.${job.name}`,
    {
      attributes: {
        "queue.name": job.queueName,
        "job.name": job.name,
        ...(typeof job.data.runId === "string" ? { "simulation.run_id": job.data.runId } : {}),
        ...(typeof job.data.agentId === "string" ? { "simulation.agent_id": job.data.agentId } : {})
      }
    },
    async (span: Span) => {
      try {
        await callback();
        span.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : "Unknown worker error"
        });
        throw error;
      } finally {
        jobDurationMs.record(Date.now() - startedAt, {
          "queue.name": job.queueName,
          "job.name": job.name
        });
      }
    }
  );
}
