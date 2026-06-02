import {
  EnvironmentStatus,
  EnvironmentType,
  EventSeverity,
  ArtifactType,
  Prisma,
  PrismaClient,
  RunStatus,
  TestAccountStatus
} from "@prisma/client";
import type {
  PersonaCreateInput,
  PersonaUpdateInput,
  TestAccountCreateInput,
  TestAccountUpdateInput,
  WorkflowCreateInput,
  WorkflowUpdateInput,
  SimulationEventType
} from "@synthetic/shared";
import { canReserveAccount } from "./test-account-reservation.js";
import type { LlmProviderConfigCreateInput, LlmProviderConfigUpdateInput } from "./llm-types.js";

export type PlatformRole = "OWNER" | "ADMIN" | "TESTER" | "VIEWER";

export type RunCreateInput = {
  organizationId: string;
  projectId: string;
  environmentId: string;
  workflowId: string;
  budgetPolicyId?: string;
  createdByUserId: string;
  selectedPersonaIds: string[];
  selectedTestAccountIds: string[];
  requestedAgentCount: number;
  maxRunDurationSeconds: number;
};

export type EventCreateInput = {
  organizationId: string;
  runId: string;
  agentId?: string;
  personaId?: string;
  eventType: SimulationEventType;
  severity?: EventSeverity;
  payload: unknown;
  timestamp?: Date;
};

export function toSimulationEventCreateData(input: EventCreateInput) {
  return {
    organizationId: input.organizationId,
    runId: input.runId,
    agentId: input.agentId,
    personaId: input.personaId,
    eventType: input.eventType,
    severity: input.severity ?? EventSeverity.INFO,
    payload: input.payload as Prisma.InputJsonValue,
    timestamp: input.timestamp ?? new Date()
  };
}

export function toSimulationEventRunQuery(runId: string, organizationId: string) {
  return {
    where: { runId, organizationId },
    orderBy: { timestamp: "asc" as const }
  };
}

export type ProjectCreateInput = { organizationId: string; name: string };
export type ProjectUpdateInput = { name?: string };
export type ArtifactCreateInput = {
  simulationRunId: string;
  simulationAgentId: string;
  type: ArtifactType;
  uri: string;
};

export type FindingCreateInput = {
  simulationRunId: string;
  type:
    | "UX_FRICTION"
    | "BUG"
    | "PERFORMANCE_ISSUE"
    | "ACCESSIBILITY_CONCERN"
    | "WORKFLOW_FAILURE"
    | "SECURITY_CONCERN"
    | "DATA_VALIDATION_ISSUE"
    | "CONFUSING_COPY";
  title: string;
  summary: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  confidence: number;
  affectedPersonas: string[];
  affectedWorkflow: string;
  evidenceEventIds: string[];
  recommendation: string;
  detail?: string | null;
};

export type LlmUsageCreateInput = {
  organizationId: string;
  runId: string;
  agentId?: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
};

export type EnvironmentCreateInput = {
  organizationId: string;
  projectId: string;
  name: string;
  baseUrl: string;
  type: EnvironmentType;
  allowedDomains: string[];
  status: EnvironmentStatus;
};

export type EnvironmentUpdateInput = {
  name?: string;
  baseUrl?: string;
  type?: EnvironmentType;
  allowedDomains?: string[];
  status?: EnvironmentStatus;
};

export type ActualWorkflowMetricCreateInput = {
  workflowId: string;
  taskSuccessRate: number;
  completionTimeMs: number;
  errorRate: number;
  apiCallsPerSession: number;
  supportTicketCount: number;
};

export type ActualMetricsImportCreateInput = {
  organizationId: string;
  projectId: string;
  environmentId: string;
  importedByUserId: string;
  sourceType?: string;
  sourceLabel: string;
  notes?: string;
  periodStart: Date;
  periodEnd: Date;
  metrics: ActualWorkflowMetricCreateInput[];
};

export type PredictionAccuracyCreateInput = {
  organizationId: string;
  actualMetricsImportId: string;
  actualWorkflowMetricId: string;
  simulationRunId?: string | null;
  projectId: string;
  environmentId: string;
  workflowId: string;
  syntheticTaskSuccessRate: number;
  actualTaskSuccessRate: number;
  taskSuccessGapPercent?: number | null;
  syntheticCompletionTimeMs: number;
  actualCompletionTimeMs: number;
  completionTimeGapPercent?: number | null;
  syntheticErrorRate: number;
  actualErrorRate: number;
  errorRateGapPercent?: number | null;
  syntheticApiCallsPerSession: number;
  actualApiCallsPerSession: number;
  apiCallsGapPercent?: number | null;
  syntheticSupportTicketEstimate: number;
  actualSupportTicketCount: number;
  supportTicketGapPercent?: number | null;
};

const prisma = new PrismaClient();

export type AuthenticatedUser = {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: PlatformRole;
  passwordHash: string;
};

export class UserRepository {
  async findByEmail(email: string): Promise<AuthenticatedUser | null> {
    const user = await prisma.user.findUnique({ where: { email } } as never);
    if (!user) return null;
    return {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      name: user.name,
      role: user.role as PlatformRole,
      passwordHash: (user as { passwordHash: string }).passwordHash
    };
  }

  async findSafeById(id: string) {
    const user = await prisma.user.findUnique({ where: { id } } as never);
    if (!user) return null;
    return {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      name: user.name,
      role: user.role as PlatformRole,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }
}

export class ProjectRepository {
  async listByOrganization(organizationId: string) {
    return prisma.project.findMany({
      where: { organizationId },
      include: { environments: true },
      orderBy: { createdAt: "asc" }
    });
  }

  async findByIdForOrganization(projectId: string, organizationId: string) {
    return prisma.project.findFirst({
      where: { id: projectId, organizationId },
      include: { environments: true }
    });
  }

  async create(input: ProjectCreateInput) {
    return prisma.project.create({ data: input });
  }

  async updateForOrganization(projectId: string, organizationId: string, input: ProjectUpdateInput) {
    return prisma.project.updateMany({ where: { id: projectId, organizationId }, data: input });
  }

  async deleteForOrganization(projectId: string, organizationId: string) {
    return prisma.project.deleteMany({ where: { id: projectId, organizationId } });
  }
}

export class EnvironmentRepository {
  async listByProjectForOrganization(projectId: string, organizationId: string) {
    return prisma.environment.findMany({ where: { projectId, organizationId }, orderBy: { createdAt: "asc" } });
  }

  async listByOrganization(organizationId: string) {
    return prisma.environment.findMany({ where: { organizationId }, orderBy: { createdAt: "asc" } });
  }

  async create(input: EnvironmentCreateInput) {
    return prisma.environment.create({ data: input });
  }

  async findByIdForProjectAndOrganization(environmentId: string, projectId: string, organizationId: string) {
    return prisma.environment.findFirst({ where: { id: environmentId, projectId, organizationId } });
  }

  async updateForProjectAndOrganization(
    environmentId: string,
    projectId: string,
    organizationId: string,
    input: EnvironmentUpdateInput
  ) {
    return prisma.environment.updateMany({ where: { id: environmentId, projectId, organizationId }, data: input });
  }

  async deleteForProjectAndOrganization(environmentId: string, projectId: string, organizationId: string) {
    return prisma.environment.deleteMany({ where: { id: environmentId, projectId, organizationId } });
  }
}

export class PersonaRepository {
  async listByOrganization(organizationId: string) {
    return prisma.persona.findMany({ where: { organizationId }, orderBy: { createdAt: "asc" } });
  }

  async findByIdForOrganization(personaId: string, organizationId: string) {
    return prisma.persona.findFirst({ where: { id: personaId, organizationId } });
  }

  async createForOrganization(organizationId: string, input: PersonaCreateInput) {
    return prisma.persona.create({ data: { organizationId, ...input } });
  }

  async updateForOrganization(personaId: string, organizationId: string, input: PersonaUpdateInput) {
    return prisma.persona.updateMany({ where: { id: personaId, organizationId }, data: input });
  }

  async deleteForOrganization(personaId: string, organizationId: string) {
    return prisma.persona.deleteMany({ where: { id: personaId, organizationId } });
  }
}

export class TestAccountRepository {
  async listByEnvironmentForOrganization(environmentId: string, organizationId: string) {
    return prisma.testAccount.findMany({
      where: { environmentId, organizationId },
      orderBy: { createdAt: "asc" },
      include: { reservations: { where: { releasedAt: null } } }
    });
  }

  async createForOrganization(organizationId: string, input: TestAccountCreateInput) {
    return prisma.testAccount.create({ data: { ...input, organizationId } });
  }

  async bulkCreateForOrganization(organizationId: string, inputs: TestAccountCreateInput[]) {
    return prisma.$transaction(
      inputs.map((input) => prisma.testAccount.create({ data: { ...input, organizationId } }))
    );
  }

  async updateForOrganization(id: string, organizationId: string, input: TestAccountUpdateInput) {
    return prisma.testAccount.updateMany({ where: { id, organizationId }, data: input });
  }

  async deleteForOrganization(id: string, organizationId: string) {
    return prisma.testAccount.deleteMany({ where: { id, organizationId } });
  }

  async findByIdForOrganization(id: string, organizationId: string) {
    return prisma.testAccount.findFirst({
      where: { id, organizationId },
      include: { reservations: { where: { releasedAt: null } } }
    });
  }

  async listByIdsForOrganization(ids: string[], organizationId: string) {
    return prisma.testAccount.findMany({
      where: { id: { in: ids }, organizationId },
      include: { reservations: { where: { releasedAt: null } } }
    });
  }

  async reserveAccountForRun(input: {
    testAccountId: string;
    organizationId: string;
    runId: string;
    agentId: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const account = await tx.testAccount.findFirst({
        where: { id: input.testAccountId, organizationId: input.organizationId },
        include: { reservations: { where: { releasedAt: null } } }
      });

      if (!account) {
        return { ok: false as const, reason: "NOT_FOUND" };
      }

      const canReserve = canReserveAccount({
        allowConcurrentUse: account.allowConcurrentUse,
        activeReservationCount: account.reservations.length,
        status: account.status as "AVAILABLE" | "RESERVED" | "DISABLED"
      });

      if (!canReserve) {
        return { ok: false as const, reason: "UNAVAILABLE" };
      }

      await tx.testAccountReservation.create({
        data: {
          testAccountId: account.id,
          runId: input.runId,
          agentId: input.agentId
        }
      });

      if (account.status !== TestAccountStatus.RESERVED) {
        await tx.testAccount.update({ where: { id: account.id }, data: { status: TestAccountStatus.RESERVED } });
      }

      return { ok: true as const };
    });
  }

  async releaseAccountReservation(input: {
    testAccountId: string;
    organizationId: string;
    runId: string;
    agentId: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const account = await tx.testAccount.findFirst({
        where: { id: input.testAccountId, organizationId: input.organizationId }
      });
      if (!account) {
        return { ok: false as const, reason: "NOT_FOUND" };
      }

      await tx.testAccountReservation.updateMany({
        where: {
          testAccountId: input.testAccountId,
          runId: input.runId,
          agentId: input.agentId,
          releasedAt: null
        },
        data: { releasedAt: new Date() }
      });

      const activeReservations = await tx.testAccountReservation.count({
        where: { testAccountId: input.testAccountId, releasedAt: null }
      });

      if (activeReservations === 0 && account.status !== TestAccountStatus.DISABLED) {
        await tx.testAccount.update({
          where: { id: input.testAccountId },
          data: { status: TestAccountStatus.AVAILABLE }
        });
      }

      return { ok: true as const };
    });
  }
}

export class RunRepository {
  async createPending(input: RunCreateInput) {
    const personaId = input.selectedPersonaIds[0] ?? null;
    return prisma.simulationRun.create({
      data: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        environmentId: input.environmentId,
        workflowId: input.workflowId,
        budgetPolicyId: input.budgetPolicyId,
        createdByUserId: input.createdByUserId,
        personaId,
        selectedPersonaIds: input.selectedPersonaIds,
        selectedTestAccountIds: input.selectedTestAccountIds,
        requestedAgentCount: input.requestedAgentCount,
        maxRunDurationSeconds: input.maxRunDurationSeconds,
        status: RunStatus.PENDING
      }
    });
  }

  async updateStatus(runId: string, status: RunStatus) {
    return prisma.simulationRun.update({
      where: { id: runId },
      data: {
        status,
        ...(status === RunStatus.RUNNING ? { startedAt: new Date(), finishedAt: null } : {}),
        ...(status === RunStatus.COMPLETED || status === RunStatus.FAILED || status === RunStatus.CANCELED
          ? { finishedAt: new Date() }
          : {})
      }
    });
  }

  async finalizeStatus(runId: string, status: RunStatus) {
    return prisma.simulationRun.updateMany({
      where: {
        id: runId,
        status: { in: [RunStatus.PENDING, RunStatus.RUNNING] }
      },
      data: {
        status,
        finishedAt: new Date()
      }
    });
  }

  async getById(runId: string) {
    return prisma.simulationRun.findUnique({ where: { id: runId } });
  }

  async getExecutionById(runId: string) {
    return prisma.simulationRun.findUnique({
      where: { id: runId },
      include: {
        environment: true,
        workflow: true,
        project: true,
        budgetPolicy: true
      }
    });
  }

  async createAgent(input: {
    simulationRunId: string;
    personaId?: string;
    testAccountId?: string;
    status?: "IDLE" | "RUNNING" | "COMPLETED" | "FAILED";
    startedAt?: Date | null;
  }) {
    return prisma.simulationAgent.create({
      data: {
        simulationRunId: input.simulationRunId,
        personaId: input.personaId ?? null,
        testAccountId: input.testAccountId ?? null,
        status: input.status ?? "RUNNING",
        startedAt: input.startedAt ?? new Date()
      }
    });
  }

  async updateAgentStatus(
    agentId: string,
    status: "IDLE" | "RUNNING" | "COMPLETED" | "FAILED",
    opts?: { finishedAt?: Date }
  ) {
    return prisma.simulationAgent.update({
      where: { id: agentId },
      data: {
        status,
        ...(opts?.finishedAt ? { finishedAt: opts.finishedAt } : {})
      }
    });
  }

  async getAgentById(agentId: string) {
    return prisma.simulationAgent.findUnique({ where: { id: agentId } });
  }

  async listAgentsByRun(runId: string) {
    return prisma.simulationAgent.findMany({ where: { simulationRunId: runId }, orderBy: { createdAt: "asc" } });
  }

  async findLatestCompletedForWorkflow(input: {
    organizationId: string;
    projectId: string;
    environmentId: string;
    workflowId: string;
  }) {
    return prisma.simulationRun.findFirst({
      where: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        environmentId: input.environmentId,
        workflowId: input.workflowId,
        status: RunStatus.COMPLETED
      },
      include: {
        environment: true,
        workflow: true,
        project: true,
        budgetPolicy: true,
        agents: true,
        findings: true
      },
      orderBy: [{ finishedAt: "desc" }, { createdAt: "desc" }]
    });
  }
}

export class BudgetPolicyRepository {
  async listByOrganization(organizationId: string) {
    return prisma.budgetPolicy.findMany({ where: { organizationId, isActive: true }, orderBy: { createdAt: "asc" } });
  }

  async findByIdForOrganization(id: string, organizationId: string) {
    return prisma.budgetPolicy.findFirst({ where: { id, organizationId, isActive: true } });
  }
}

export class LlmUsageRepository {
  async create(input: LlmUsageCreateInput) {
    return prisma.llmUsage.create({
      data: {
        organizationId: input.organizationId,
        runId: input.runId,
        agentId: input.agentId ?? null,
        provider: input.provider,
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        totalTokens: input.totalTokens,
        estimatedCostUsd: new Prisma.Decimal(input.estimatedCostUsd)
      }
    });
  }

  async getRunUsageTotals(runId: string, organizationId: string) {
    const usage = await prisma.llmUsage.aggregate({
      where: { runId, organizationId },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        estimatedCostUsd: true
      }
    });

    return {
      inputTokens: usage._sum.inputTokens ?? 0,
      outputTokens: usage._sum.outputTokens ?? 0,
      totalTokens: usage._sum.totalTokens ?? 0,
      estimatedCostUsd: Number(usage._sum.estimatedCostUsd ?? 0)
    };
  }

  async getDailyCostTotal(organizationId: string, dayStart: Date, dayEnd: Date) {
    const usage = await prisma.llmUsage.aggregate({
      where: { organizationId, createdAt: { gte: dayStart, lt: dayEnd } },
      _sum: { estimatedCostUsd: true }
    });
    return Number(usage._sum.estimatedCostUsd ?? 0);
  }

  async listByRun(runId: string, organizationId: string) {
    return prisma.llmUsage.findMany({
      where: { runId, organizationId },
      orderBy: { createdAt: "asc" }
    });
  }

  async countByRunAndAgent(runId: string, organizationId: string, agentId: string) {
    return prisma.llmUsage.count({ where: { runId, organizationId, agentId } });
  }
}

export class LlmProviderConfigRepository {
  async listByOrganization(organizationId: string) {
    return prisma.llmProviderConfig.findMany({
      where: { organizationId, isActive: true },
      orderBy: { createdAt: "asc" }
    });
  }

  async findByIdForOrganization(id: string, organizationId: string) {
    return prisma.llmProviderConfig.findFirst({ where: { id, organizationId, isActive: true } });
  }

  async create(input: LlmProviderConfigCreateInput) {
    return prisma.llmProviderConfig.create({
      data: {
        organizationId: input.organizationId,
        provider: input.provider,
        model: input.model,
        encryptedApiKey: input.encryptedApiKey,
        baseUrl: input.baseUrl,
        timeoutMs: input.timeoutMs ?? 30000,
        status: input.status ?? "inactive",
        isActive: input.isActive ?? true
      }
    });
  }

  async updateForOrganization(id: string, organizationId: string, input: LlmProviderConfigUpdateInput) {
    return prisma.llmProviderConfig.updateMany({
      where: { id, organizationId, isActive: true },
      data: input
    });
  }
}

export class WorkflowRepository {
  async listByProjectForOrganization(projectId: string, organizationId: string) {
    return prisma.workflow.findMany({
      where: { projectId, organizationId },
      orderBy: { createdAt: "asc" }
    });
  }

  async findByIdForOrganization(id: string, organizationId: string) {
    return prisma.workflow.findFirst({ where: { id, organizationId } });
  }

  async createForOrganization(organizationId: string, input: WorkflowCreateInput) {
    return prisma.workflow.create({ data: { ...input, organizationId } });
  }

  async updateForOrganization(id: string, organizationId: string, input: WorkflowUpdateInput) {
    return prisma.workflow.updateMany({ where: { id, organizationId }, data: input });
  }

  async deleteForOrganization(id: string, organizationId: string) {
    return prisma.workflow.deleteMany({ where: { id, organizationId } });
  }

  async listByOrganization(organizationId: string) {
    return prisma.workflow.findMany({
      where: { organizationId },
      orderBy: [{ projectId: "asc" }, { createdAt: "asc" }]
    });
  }
}

export class EventRepository {
  async create(input: EventCreateInput) {
    return prisma.simulationEvent.create({ data: toSimulationEventCreateData(input) });
  }

  async listByRunForOrganization(runId: string, organizationId: string) {
    return prisma.simulationEvent.findMany(toSimulationEventRunQuery(runId, organizationId));
  }
}

export class ArtifactRepository {
  async create(input: ArtifactCreateInput) {
    return prisma.artifact.create({ data: input });
  }

  async findByIdForRunForOrganization(artifactId: string, runId: string, organizationId: string) {
    return prisma.artifact.findFirst({
      where: {
        id: artifactId,
        simulationRunId: runId,
        simulationRun: { organizationId }
      }
    });
  }

  async listByRunForOrganization(runId: string, organizationId: string) {
    return prisma.artifact.findMany({
      where: { simulationRunId: runId, simulationRun: { organizationId } },
      orderBy: { createdAt: "desc" }
    });
  }
}

export class FindingRepository {
  async replaceForRun(simulationRunId: string, findings: FindingCreateInput[]) {
    await prisma.finding.deleteMany({ where: { simulationRunId } });
    if (findings.length === 0) return { count: 0 };

    const created = await prisma.$transaction(
      findings.map((finding) =>
        prisma.finding.create({
          data: {
            simulationRunId: finding.simulationRunId,
            type: finding.type,
            title: finding.title,
            summary: finding.summary,
            severity: finding.severity,
            confidence: new Prisma.Decimal(finding.confidence),
            affectedPersonas: finding.affectedPersonas,
            affectedWorkflow: finding.affectedWorkflow,
            evidenceEventIds: finding.evidenceEventIds,
            recommendation: finding.recommendation,
            detail: finding.detail ?? null
          }
        })
      )
    );
    return { count: created.length };
  }

  async listByRunForOrganization(runId: string, organizationId: string) {
    return prisma.finding.findMany({
      where: { simulationRunId: runId, simulationRun: { organizationId } },
      orderBy: { createdAt: "desc" }
    });
  }
}

export class ActualMetricsImportRepository {
  async createWithMetrics(input: ActualMetricsImportCreateInput) {
    return prisma.actualMetricsImport.create({
      data: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        environmentId: input.environmentId,
        importedByUserId: input.importedByUserId,
        sourceType: input.sourceType ?? "MANUAL_CSV",
        sourceLabel: input.sourceLabel,
        notes: input.notes ?? "",
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        rowCount: input.metrics.length,
        workflowMetrics: {
          create: input.metrics.map((metric) => ({
            organizationId: input.organizationId,
            projectId: input.projectId,
            environmentId: input.environmentId,
            workflowId: metric.workflowId,
            taskSuccessRate: new Prisma.Decimal(metric.taskSuccessRate),
            completionTimeMs: metric.completionTimeMs,
            errorRate: new Prisma.Decimal(metric.errorRate),
            apiCallsPerSession: new Prisma.Decimal(metric.apiCallsPerSession),
            supportTicketCount: metric.supportTicketCount
          }))
        }
      },
      include: {
        workflowMetrics: {
          include: { workflow: true }
        },
        project: true,
        environment: true
      }
    });
  }

  async listByEnvironmentForOrganization(input: {
    organizationId: string;
    projectId?: string;
    environmentId?: string;
  }) {
    return prisma.actualMetricsImport.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.projectId ? { projectId: input.projectId } : {}),
        ...(input.environmentId ? { environmentId: input.environmentId } : {})
      },
      include: {
        project: true,
        environment: true,
        importedByUser: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async findLatestForEnvironment(input: {
    organizationId: string;
    projectId?: string;
    environmentId?: string;
  }) {
    return prisma.actualMetricsImport.findFirst({
      where: {
        organizationId: input.organizationId,
        ...(input.projectId ? { projectId: input.projectId } : {}),
        ...(input.environmentId ? { environmentId: input.environmentId } : {})
      },
      include: {
        workflowMetrics: {
          include: {
            workflow: true,
            predictionAccuracies: {
              orderBy: { createdAt: "desc" },
              include: { simulationRun: true }
            }
          },
          orderBy: { createdAt: "asc" }
        },
        project: true,
        environment: true,
        importedByUser: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
  }
}

export class PredictionAccuracyRepository {
  async replaceForImport(actualMetricsImportId: string, rows: PredictionAccuracyCreateInput[]) {
    await prisma.predictionAccuracy.deleteMany({ where: { actualMetricsImportId } });
    if (rows.length === 0) return { count: 0 };

    const created = await prisma.$transaction(
      rows.map((row) =>
        prisma.predictionAccuracy.create({
          data: {
            organizationId: row.organizationId,
            actualMetricsImportId: row.actualMetricsImportId,
            actualWorkflowMetricId: row.actualWorkflowMetricId,
            simulationRunId: row.simulationRunId ?? null,
            projectId: row.projectId,
            environmentId: row.environmentId,
            workflowId: row.workflowId,
            syntheticTaskSuccessRate: new Prisma.Decimal(row.syntheticTaskSuccessRate),
            actualTaskSuccessRate: new Prisma.Decimal(row.actualTaskSuccessRate),
            taskSuccessGapPercent:
              row.taskSuccessGapPercent == null ? null : new Prisma.Decimal(row.taskSuccessGapPercent),
            syntheticCompletionTimeMs: row.syntheticCompletionTimeMs,
            actualCompletionTimeMs: row.actualCompletionTimeMs,
            completionTimeGapPercent:
              row.completionTimeGapPercent == null ? null : new Prisma.Decimal(row.completionTimeGapPercent),
            syntheticErrorRate: new Prisma.Decimal(row.syntheticErrorRate),
            actualErrorRate: new Prisma.Decimal(row.actualErrorRate),
            errorRateGapPercent:
              row.errorRateGapPercent == null ? null : new Prisma.Decimal(row.errorRateGapPercent),
            syntheticApiCallsPerSession: new Prisma.Decimal(row.syntheticApiCallsPerSession),
            actualApiCallsPerSession: new Prisma.Decimal(row.actualApiCallsPerSession),
            apiCallsGapPercent:
              row.apiCallsGapPercent == null ? null : new Prisma.Decimal(row.apiCallsGapPercent),
            syntheticSupportTicketEstimate: row.syntheticSupportTicketEstimate,
            actualSupportTicketCount: row.actualSupportTicketCount,
            supportTicketGapPercent:
              row.supportTicketGapPercent == null ? null : new Prisma.Decimal(row.supportTicketGapPercent)
          }
        })
      )
    );

    return { count: created.length };
  }
}

export async function disconnectDatabaseClient(): Promise<void> {
  await prisma.$disconnect();
}

