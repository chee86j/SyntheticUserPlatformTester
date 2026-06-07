import { mkdir } from "node:fs/promises";
import {
  ArtifactRepository,
  LlmProviderConfigRepository,
  PersonaRepository,
  RunRepository,
  TestAccountRepository
} from "@synthetic/database";
import { RunStatus, type EventSeverity } from "@prisma/client";
import { buildScript } from "../lib/script-builder.js";
import { toStoredArtifactLocator } from "../lib/artifact-storage.js";
import { executeScriptedWorkflow, ProductWorkflowError } from "../lib/playwright-runner.js";
import { getRunDirectory } from "../lib/paths.js";
import { decryptSecret } from "../lib/secrets.js";
import { env } from "../lib/config.js";
import { enqueueReportJob } from "../queue/queues.js";
import { AccountReservationService } from "./account-reservation-service.js";
import { EventEmitterService } from "./event-emitter-service.js";
import { runSingleLlmAgent } from "./llm-agent-runner.js";
import type { PersonaTraits } from "./persona-behavior-service.js";

class InfrastructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InfrastructureError";
  }
}

export class AgentJobProcessor {
  private readonly personaRepository = new PersonaRepository();
  private readonly llmProviderConfigRepository = new LlmProviderConfigRepository();

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

    const runDir = getRunDirectory(run.id, agent.id);
    await mkdir(runDir, { recursive: true });
    const allowedDomains = run.environment.allowedDomains ?? [];
    const timeoutMs = resolveAgentTimeoutMs(run.maxRunDurationSeconds, run.budgetPolicy?.maxDurationPerRunSeconds ?? null);

    try {
      await this.eventEmitter.emit({ runId: run.id, agentId: agent.id, personaId, eventType: "agent.started", payload: { accountLabel: account.label } });
      await this.eventEmitter.emit({ runId: run.id, agentId: agent.id, personaId, eventType: "agent.logged_in", payload: { accountLabel: account.label } });

      let actionCount = 0;
      const emit = (payload: {
        eventType:
          | "action.started"
          | "action.completed"
          | "action.failed"
          | "screenshot.captured"
          | "artifact.created"
          | "console.error"
          | "network.failed";
        severity?: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
        payload: Record<string, unknown>;
      }) => {
        if (payload.eventType === "action.completed") {
          actionCount += 1;
        }

        return this.eventEmitter.emit({
          runId: run.id,
          agentId: agent.id,
          personaId,
          eventType: payload.eventType,
          severity: payload.severity as EventSeverity | undefined,
          payload: payload.payload
        });
      };

      const onArtifact = async (artifact: {
        type: "SCREENSHOT" | "TRACE" | "VIDEO" | "CONSOLE_LOG" | "NETWORK_LOG";
        uri: string;
      }) => {
        await this.artifactRepository.create({
          simulationRunId: run.id,
          simulationAgentId: agent.id,
          type: artifact.type,
          uri: toStoredArtifactLocator(artifact.uri)
        });
      };

      if (env.RUNNER_USE_LLM) {
        const providerConfigId = await this.resolveProviderConfigId(run.organizationId);
        if (!providerConfigId) {
          throw new InfrastructureError("No active LLM provider config available for LLM runner");
        }

        const persona = personaId
          ? await this.personaRepository.findByIdForOrganization(personaId, run.organizationId)
          : null;

        const startUrl = new URL(run.workflow.startingPath || "/", run.environment.baseUrl).toString();
        const llmResult = await runSingleLlmAgent({
          runId: run.id,
          agentId: agent.id,
          runDir,
          startUrl,
          baseUrl: run.environment.baseUrl,
          allowedDomains,
          timeoutMs,
          workflow: {
            goal: run.workflow.goal,
            startingPath: run.workflow.startingPath,
            maxSteps: run.workflow.maxSteps,
            successCriteria: run.workflow.successCriteria
          },
          personaTraits: toPersonaTraits(persona),
          llmComplete: async ({ prompt: llmPrompt, runId: llmRunId, agentId: llmAgentId }) =>
            this.eventEmitter.completeWithLlm({
              runId: llmRunId,
              agentId: llmAgentId,
              providerConfigId,
              prompt: llmPrompt
            }),
          emit,
          onArtifact,
          maxActionsPerAgent: run.budgetPolicy?.maxActionsPerAgent ?? null
        });

        if (!llmResult.completed) {
          throw new ProductWorkflowError("LLM agent did not satisfy workflow success criteria");
        }
      } else {
        const actions = buildScript(
          { startingPath: run.workflow.startingPath, successCriteria: run.workflow.successCriteria },
          run.environment.baseUrl,
          { username: account.username, password: accountPassword }
        );

        await executeScriptedWorkflow({
          actions,
          runDir,
          baseUrl: run.environment.baseUrl,
          allowedDomains,
          maxActions: run.budgetPolicy?.maxActionsPerAgent ?? null,
          timeoutMs,
          emit,
          onArtifact
        });
      }

      await this.runRepository.updateAgentStatus(agent.id, "COMPLETED", { finishedAt: new Date() });
      await this.eventEmitter.emit({ runId: run.id, agentId: agent.id, personaId, eventType: "workflow.completed", payload: { actions: actionCount } });
      await this.eventEmitter.emit({ runId: run.id, agentId: agent.id, personaId, eventType: "agent.completed", payload: { actions: actionCount } });

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

  private async resolveProviderConfigId(organizationId: string): Promise<string | null> {
    if (env.RUNNER_LLM_PROVIDER_CONFIG_ID) return env.RUNNER_LLM_PROVIDER_CONFIG_ID;
    const configs = await this.llmProviderConfigRepository.listByOrganization(organizationId);
    const active = configs.find((config) => config.status === "active" && config.isActive);
    return active?.id ?? null;
  }

  private async maybeCompleteRun(runId: string): Promise<void> {
    const agents = await this.runRepository.listAgentsByRun(runId);
    const incomplete = agents.filter((agent) => agent.status === "IDLE" || agent.status === "RUNNING");

    if (incomplete.length > 0) return;

    const failed = agents.some((agent) => agent.status === "FAILED");
    const finalized = await this.runRepository.finalizeStatus(runId, failed ? RunStatus.FAILED : RunStatus.COMPLETED);
    if (finalized.count === 0) {
      const run = await this.runRepository.getById(runId);
      if (run && (run.status === RunStatus.COMPLETED || run.status === RunStatus.FAILED)) {
        await enqueueReportJob(runId);
      }
      return;
    }

    await this.eventEmitter.emit({
      runId,
      eventType: failed ? "run.failed" : "run.completed",
      severity: failed ? "CRITICAL" : "INFO",
      payload: failed
        ? {
            reason: "One or more agents failed during execution",
            failedAgents: agents.filter((agent) => agent.status === "FAILED").length
          }
        : {
            failedAgents: 0
          }
    });

    await enqueueReportJob(runId);
  }
}

function toPersonaTraits(
  persona:
    | {
        name: string;
        role: string;
        industry: string;
        technicalProficiency: number;
        domainExpertise: number;
        timePressure: number;
        patience: number;
        confidence: number;
        errorRecovery: number;
        riskTolerance: number;
        accessibilityNeeds: string[];
        behaviorNotes: string;
      }
    | null
): PersonaTraits | null {
  if (!persona) return null;

  return {
    name: persona.name,
    role: persona.role,
    industry: persona.industry,
    technicalProficiency: persona.technicalProficiency,
    domainExpertise: persona.domainExpertise,
    timePressure: persona.timePressure,
    patience: persona.patience,
    confidence: persona.confidence,
    errorRecovery: persona.errorRecovery,
    riskTolerance: persona.riskTolerance,
    accessibilityNeeds: persona.accessibilityNeeds,
    behaviorNotes: persona.behaviorNotes
  };
}

function resolveAgentTimeoutMs(runTimeoutSeconds: number, budgetTimeoutSeconds: number | null): number {
  const candidates = [runTimeoutSeconds, budgetTimeoutSeconds].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0
  );
  return Math.min(...candidates) * 1000;
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
