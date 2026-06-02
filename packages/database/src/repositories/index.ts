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
    return prisma.simulationRun.update({ where: { id: runId }, data: { status } });
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
        project: true
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

  async listByRunForOrganization(runId: string, organizationId: string) {
    return prisma.artifact.findMany({
      where: { simulationRunId: runId, simulationRun: { organizationId } },
      orderBy: { createdAt: "desc" }
    });
  }
}

export async function disconnectDatabaseClient(): Promise<void> {
  await prisma.$disconnect();
}

