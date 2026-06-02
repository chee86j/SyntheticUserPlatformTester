import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ArtifactRepository,
  BudgetPolicyRepository,
  EventRepository,
  FindingRepository,
  LlmUsageRepository,
  PersonaRepository,
  RunRepository
} from '@synthetic/database';
import { ArtifactType } from '@prisma/client';
import { generateRunReportMarkdown } from '@synthetic/reports';
import { toStoredArtifactLocator } from "../lib/artifact-storage.js";
import { getRunDirectory } from "../lib/paths.js";
import { EventEmitterService } from "./event-emitter-service.js";

export class RunReportService {
  private readonly eventRepository = new EventRepository();
  private readonly artifactRepository = new ArtifactRepository();
  private readonly personaRepository = new PersonaRepository();
  private readonly findingRepository = new FindingRepository();
  private readonly llmUsageRepository = new LlmUsageRepository();
  private readonly budgetPolicyRepository = new BudgetPolicyRepository();

  constructor(
    private readonly runRepository: RunRepository,
    private readonly eventEmitter: EventEmitterService
  ) {}

  async generate(runId: string): Promise<{ reportPath: string; artifactId: string }> {
    const run = await this.runRepository.getExecutionById(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    const [agents, events, artifacts, personas, findings, llmUsage, budgetPolicy] = await Promise.all([
      this.runRepository.listAgentsByRun(run.id),
      this.eventRepository.listByRunForOrganization(run.id, run.organizationId),
      this.artifactRepository.listByRunForOrganization(run.id, run.organizationId),
      this.personaRepository.listByOrganization(run.organizationId),
      this.findingRepository.listByRunForOrganization(run.id, run.organizationId),
      this.llmUsageRepository.listByRun(run.id, run.organizationId),
      run.budgetPolicyId
        ? this.budgetPolicyRepository.findByIdForOrganization(run.budgetPolicyId, run.organizationId)
        : Promise.resolve(null)
    ]);

    if (agents.length === 0) {
      throw new Error(`Run ${run.id} has no agents to attach report artifact`);
    }

    const reportDirectory = getRunDirectory(run.id);
    await mkdir(reportDirectory, { recursive: true });

    const budgetTotals = await this.llmUsageRepository.getRunUsageTotals(run.id, run.organizationId);
    const reportPath = path.join(reportDirectory, "report.md");
    const markdown = generateRunReportMarkdown({
      generatedAt: new Date(),
      run: {
        id: run.id,
        status: run.status,
        createdAt: run.createdAt,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        requestedAgentCount: run.requestedAgentCount,
        maxRunDurationSeconds: run.maxRunDurationSeconds,
        project: { name: run.project.name },
        environment: {
          name: run.environment.name,
          baseUrl: run.environment.baseUrl,
          type: run.environment.type
        },
        workflow: {
          name: run.workflow.name,
          goal: run.workflow.goal,
          startingPath: run.workflow.startingPath,
          workflowType: run.workflow.workflowType,
          maxSteps: run.workflow.maxSteps,
          maxDurationSeconds: run.workflow.maxDurationSeconds,
          successCriteria: run.workflow.successCriteria
        },
        budgetPolicy: budgetPolicy
          ? {
              name: budgetPolicy.name,
              maxCostPerRun: budgetPolicy.maxCostPerRun == null ? null : Number(budgetPolicy.maxCostPerRun),
              maxTokensPerRun: budgetPolicy.maxTokensPerRun,
              maxActionsPerAgent: budgetPolicy.maxActionsPerAgent,
              maxDurationPerRunSeconds: budgetPolicy.maxDurationPerRunSeconds
            }
          : null
      },
      personas: personas.filter((persona) => run.selectedPersonaIds.includes(persona.id)),
      agents,
      events: events.map((event) => ({
        ...event,
        payload: asRecord(event.payload)
      })),
      artifacts,
      findings: findings.map((finding) => ({
        type: finding.type,
        title: finding.title,
        summary: finding.summary,
        severity: finding.severity,
        recommendation: finding.recommendation
      })),
      llmUsage: llmUsage.map((usage) => ({
        provider: usage.provider,
        model: usage.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        estimatedCostUsd: Number(usage.estimatedCostUsd),
        agentId: usage.agentId
      })),
      budgetSummary: {
        totals: budgetTotals,
        remaining: {
          cost:
            budgetPolicy?.maxCostPerRun == null ? null : Number(budgetPolicy.maxCostPerRun) - budgetTotals.estimatedCostUsd,
          tokens: budgetPolicy?.maxTokensPerRun == null ? null : budgetPolicy.maxTokensPerRun - budgetTotals.totalTokens
        },
        projected: {
          next1000TokensCost:
            budgetTotals.totalTokens > 0 ? (budgetTotals.estimatedCostUsd / budgetTotals.totalTokens) * 1000 : null
        }
      }
    });

    await writeFile(reportPath, markdown, "utf8");
    const reportLocator = toStoredArtifactLocator(reportPath);

    const artifact = await this.artifactRepository.create({
      simulationRunId: run.id,
      simulationAgentId: agents[0].id,
      type: ArtifactType.REPORT,
      uri: reportLocator
    });

    await this.eventEmitter.emit({
      runId: run.id,
      agentId: agents[0].id,
      eventType: "artifact.created",
      payload: { artifactId: artifact.id, type: "REPORT", uri: reportLocator }
    });

    return { reportPath, artifactId: artifact.id };
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}
