import {
  EnvironmentStatus,
  EnvironmentType,
  EventSeverity,
  Prisma,
  PrismaClient,
  RunStatus
} from "@prisma/client";
import type { PersonaCreateInput, PersonaUpdateInput } from "@synthetic/shared";

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

export type ProjectCreateInput = {
  organizationId: string;
  name: string;
};

export type ProjectUpdateInput = {
  name?: string;
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

export class RunRepository {
  async create(input: RunCreateInput) {
    return prisma.simulationRun.create({ data: { ...input, status: RunStatus.PENDING } });
  }

  async updateStatus(runId: string, status: RunStatus) {
    return prisma.simulationRun.update({ where: { id: runId }, data: { status } });
  }

  async getById(runId: string) {
    return prisma.simulationRun.findUnique({ where: { id: runId } });
  }
}

export class WorkflowRepository {
  async listByProject(projectId: string) {
    return prisma.workflow.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } });
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
