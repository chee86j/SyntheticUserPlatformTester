import { RunStatus } from "@prisma/client";
import { RunRepository } from "@synthetic/database";
import { agentJobsQueue } from "../queue/queues.js";
import { EventEmitterService } from "./event-emitter-service.js";

export class RunOrchestrator {
  constructor(
    private readonly runRepository: RunRepository,
    private readonly eventEmitter: EventEmitterService
  ) {}

  async orchestrate(runId: string): Promise<void> {
    const run = await this.runRepository.getExecutionById(runId);
    if (!run) throw new Error(`Run ${runId} not found`);

    if (run.status === "CANCELED") {
      await this.eventEmitter.emit({ runId, eventType: "run.cancelled", payload: { source: "queue" } });
      return;
    }

    await this.runRepository.updateStatus(run.id, RunStatus.RUNNING);
    await this.eventEmitter.emit({ runId, eventType: "run.started", payload: { requestedAgents: run.requestedAgentCount } });

    const existingAgents = await this.runRepository.listAgentsByRun(run.id);
    if (existingAgents.length > 0) return;

    const agentCount = Math.min(run.requestedAgentCount, run.selectedTestAccountIds.length);
    for (let index = 0; index < agentCount; index += 1) {
      const agent = await this.runRepository.createAgent({
        simulationRunId: run.id,
        personaId: run.selectedPersonaIds[index % run.selectedPersonaIds.length],
        testAccountId: run.selectedTestAccountIds[index],
        status: "IDLE",
        startedAt: null
      });

      await agentJobsQueue.add(
        "run-agent",
        { runId: run.id, agentId: agent.id },
        {
          jobId: `agent:${agent.id}`,
          removeOnComplete: true,
          removeOnFail: 200,
          attempts: 3,
          backoff: { type: "exponential", delay: 1500 }
        }
      );
    }
  }
}
