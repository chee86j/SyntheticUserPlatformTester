import { mkdir } from "node:fs/promises";
import path from "node:path";
import { ArtifactRepository, RunRepository, TestAccountRepository } from "@synthetic/database";
import { RunStatus, type EventSeverity } from "@prisma/client";
import { buildScript } from "../lib/script-builder.js";
import { executeScriptedWorkflow, ProductWorkflowError } from "../lib/playwright-runner.js";
import { decryptSecret } from "../lib/secrets.js";
import { env } from "../lib/config.js";
import { AccountReservationService } from "./account-reservation-service.js";
import { EventEmitterService } from "./event-emitter-service.js";

class InfrastructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InfrastructureError";
  }
}

export class AgentJobProcessor {
  constructor(
    private readonly runRepository: RunRepository,
    private readonly testAccountRepository: TestAccountRepository,
    private readonly artifactRepository: ArtifactRepository,
    private readonly reservationService: AccountReservationService,
    private readonly eventEmitter: EventEmitterService
  ) {}

  async process(input: { runId: string; agentId: string }): Promise<void> {
    const run = await this.runRepository.getExecutionById(input.runId);
    if (!run) throw new InfrastructureError(`Run ${input.runId} not found`);

    if (run.status === "CANCELED") {
      await this.runRepository.updateAgentStatus(input.agentId, "FAILED", { finishedAt: new Date() });
      return;
    }

    const agent = await this.runRepository.getAgentById(input.agentId);
    if (!agent) throw new InfrastructureError(`Agent ${input.agentId} not found`);

    if (!agent.testAccountId) throw new InfrastructureError(`Agent ${input.agentId} has no test account`);

    const account = await this.testAccountRepository.findByIdForOrganization(agent.testAccountId, run.organizationId);
    if (!account) throw new InfrastructureError("Test account not found");

    await this.runRepository.updateAgentStatus(agent.id, "RUNNING", { finishedAt: undefined });

    const personaId = agent.personaId ?? undefined;
    const accountPassword = resolveAccountPassword(account.encryptedPassword, account.passwordSecretRef);

    await this.reservationService.reserve({ accountId: account.id, runId: run.id, agentId: agent.id });

    const runDir = path.join(process.cwd(), "runs", run.id, agent.id);
    await mkdir(runDir, { recursive: true });

    try {
      await this.eventEmitter.emit({ runId: run.id, agentId: agent.id, personaId, eventType: "agent.started", payload: { accountLabel: account.label } });
      await this.eventEmitter.emit({ runId: run.id, agentId: agent.id, personaId, eventType: "agent.logged_in", payload: { accountLabel: account.label } });

      const actions = buildScript(
        { startingPath: run.workflow.startingPath, successCriteria: run.workflow.successCriteria },
        run.environment.baseUrl,
        { username: account.username, password: accountPassword }
      );

      await executeScriptedWorkflow({
        actions,
        runDir,
        emit: (payload) =>
          this.eventEmitter.emit({
            runId: run.id,
            agentId: agent.id,
            personaId,
            eventType: payload.eventType,
            severity: payload.severity as EventSeverity | undefined,
            payload: payload.payload
          }),
        onArtifact: async (artifact) => {
          await this.artifactRepository.create({
            simulationRunId: run.id,
            simulationAgentId: agent.id,
            type: artifact.type,
            uri: artifact.uri
          });
        }
      });

      await this.runRepository.updateAgentStatus(agent.id, "COMPLETED", { finishedAt: new Date() });
      await this.eventEmitter.emit({ runId: run.id, agentId: agent.id, personaId, eventType: "workflow.completed", payload: { actions: actions.length } });
      await this.eventEmitter.emit({ runId: run.id, agentId: agent.id, personaId, eventType: "agent.completed", payload: { actions: actions.length } });

      await this.maybeCompleteRun(run.id);
    } catch (error) {
      await this.runRepository.updateAgentStatus(agent.id, "FAILED", { finishedAt: new Date() });

      const message = error instanceof Error ? error.message : "Unknown agent job error";
      await this.eventEmitter.emit({
        runId: run.id,
        agentId: agent.id,
        personaId,
        eventType: "workflow.failed",
        severity: "ERROR",
        payload: { reason: message }
      });
      await this.eventEmitter.emit({
        runId: run.id,
        agentId: agent.id,
        personaId,
        eventType: "agent.failed",
        severity: "ERROR",
        payload: { reason: message }
      });

      await this.maybeCompleteRun(run.id);

      if (error instanceof ProductWorkflowError) {
        return;
      }

      throw toInfrastructureError(error);
    } finally {
      await this.reservationService.release({ accountId: account.id, runId: run.id, agentId: agent.id }).catch(() => undefined);
    }
  }

  private async maybeCompleteRun(runId: string): Promise<void> {
    const agents = await this.runRepository.listAgentsByRun(runId);
    const incomplete = agents.filter((agent) => agent.status === "IDLE" || agent.status === "RUNNING");

    if (incomplete.length > 0) return;

    const failed = agents.some((agent) => agent.status === "FAILED");
    await this.runRepository.updateStatus(runId, failed ? RunStatus.FAILED : RunStatus.COMPLETED);

    await this.eventEmitter.emit({
      runId,
      eventType: failed ? "run.failed" : "run.completed",
      severity: failed ? "CRITICAL" : "INFO",
      payload: { failedAgents: agents.filter((agent) => agent.status === "FAILED").length }
    });
  }
}

function resolveAccountPassword(encryptedPassword: string | null, secretRef: string | null): string {
  if (encryptedPassword) {
    return decryptSecret(encryptedPassword);
  }

  if (secretRef) {
    return env.RUNNER_DEFAULT_PASSWORD;
  }

  return env.RUNNER_DEFAULT_PASSWORD;
}

function toInfrastructureError(error: unknown): InfrastructureError {
  if (error instanceof InfrastructureError) return error;
  if (error instanceof Error) {
    return new InfrastructureError(error.message);
  }
  return new InfrastructureError("Unknown infrastructure error");
}
