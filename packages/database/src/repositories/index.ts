import { EventSeverity, Prisma, PrismaClient, RunStatus } from "@prisma/client";

export type PlatformRole = "OWNER" | "ADMIN" | "TESTER" | "VIEWER";

export type RunCreateInput = {
  organizationId: string;
  projectId: string;
  environmentId: string;
  workflowId: string;
  createdByUserId: string;
  personaId?: string;
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

    if (!user) {
      return null;
    }

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

    if (!user) {
      return null;
    }

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
      orderBy: { createdAt: "asc" }
    });
  }
}

export class RunRepository {
  async create(input: RunCreateInput) {
    return prisma.simulationRun.create({
      data: {
        ...input,
        status: RunStatus.PENDING
      }
    });
  }

  async updateStatus(runId: string, status: RunStatus) {
    return prisma.simulationRun.update({
      where: { id: runId },
      data: { status }
    });
  }

  async getById(runId: string) {
    return prisma.simulationRun.findUnique({ where: { id: runId } });
  }
}

export class PersonaRepository {
  async listByOrganization(organizationId: string) {
    return prisma.persona.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" }
    });
  }
}

export class WorkflowRepository {
  async listByProject(projectId: string) {
    return prisma.workflow.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" }
    });
  }
}

export class EventRepository {
  async create(input: EventCreateInput) {
    return prisma.simulationEvent.create({
      data: {
        ...input,
        severity: input.severity ?? EventSeverity.INFO
      }
    });
  }

  async listByRun(simulationRunId: string) {
    return prisma.simulationEvent.findMany({
      where: { simulationRunId },
      orderBy: { createdAt: "asc" }
    });
  }
}

export async function disconnectDatabaseClient(): Promise<void> {
  await prisma.$disconnect();
}
