import {
  EnvironmentStatus,
  EnvironmentType,
  EventSeverity,
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
  WorkflowUpdateInput
} from "@synthetic/shared";
import { canReserveAccount } from "./test-account-reservation.js";

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
  simulationRunId: string;
  simulationAgentId?: string;
  severity?: EventSeverity;
  type: string;
  message: string;
  metadata?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
};

export type ProjectCreateInput = { organizationId: string; name: string };
export type ProjectUpdateInput = { name?: string };

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
}

export class BudgetPolicyRepository {
  async listByOrganization(organizationId: string) {
    return prisma.budgetPolicy.findMany({ where: { organizationId, isActive: true }, orderBy: { createdAt: "asc" } });
  }

  async findByIdForOrganization(id: string, organizationId: string) {
    return prisma.budgetPolicy.findFirst({ where: { id, organizationId, isActive: true } });
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
    return prisma.simulationEvent.create({ data: { ...input, severity: input.severity ?? EventSeverity.INFO } });
  }

  async listByRun(simulationRunId: string) {
    return prisma.simulationEvent.findMany({ where: { simulationRunId }, orderBy: { createdAt: "asc" } });
  }
}

export async function disconnectDatabaseClient(): Promise<void> {
  await prisma.$disconnect();
}

