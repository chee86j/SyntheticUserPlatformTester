import { ArtifactRepository, BudgetPolicyRepository, EnvironmentRepository, EventRepository, PersonaRepository, ProjectRepository, RunRepository, TestAccountRepository, WorkflowRepository } from "@synthetic/database";
import { LlmProviderConfigRepository } from "@synthetic/database";
import { createLlmProvider } from "@synthetic/llm-gateway";
import { personaCreateSchema, personaUpdateSchema, runSetupSchema, simulationEventSchema, testAccountSchema, testAccountUpdateSchema, workflowCreateSchema, workflowUpdateSchema } from "@synthetic/shared";
import type { EnvironmentStatus, EnvironmentType, WorkflowStatus } from "@prisma/client";
import { RunStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../middleware/require-auth.js";
import { decryptSecret, encryptSecret } from "../auth/secret-encryption.js";
import { emitRunEvent } from "../realtime/socket.js";
import { cancelRunJobs, enqueueAgentJob, enqueueSimulationRun } from "../queues/queues.js";

const projectRepository = new ProjectRepository();
const environmentRepository = new EnvironmentRepository();
const personaRepository = new PersonaRepository();
const testAccountRepository = new TestAccountRepository();
const workflowRepository = new WorkflowRepository();
const runRepository = new RunRepository();
const budgetPolicyRepository = new BudgetPolicyRepository();
const eventRepository = new EventRepository();
const artifactRepository = new ArtifactRepository();
const llmProviderConfigRepository = new LlmProviderConfigRepository();

const projectCreateSchema = z.object({ name: z.string().trim().min(1).max(120) });
const projectUpdateSchema = z.object({ name: z.string().trim().min(1).max(120) });

const environmentTypeSchema = z.enum(["LOCAL", "STAGING", "DEMO"]);
const environmentStatusSchema = z.enum(["ACTIVE", "INACTIVE", "UNREACHABLE"]);

const environmentCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  baseUrl: z.string().url(),
  type: environmentTypeSchema,
  allowedDomains: z.array(z.string().trim().min(1)).default([]),
  status: environmentStatusSchema.default("ACTIVE")
});

const environmentUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  baseUrl: z.string().url().optional(),
  type: environmentTypeSchema.optional(),
  allowedDomains: z.array(z.string().trim().min(1)).optional(),
  status: environmentStatusSchema.optional()
});

const idParamsSchema = z.object({ projectId: z.string().uuid() });
const personaIdParamsSchema = z.object({ personaId: z.string().uuid() });

const environmentParamsSchema = z.object({
  projectId: z.string().uuid(),
  environmentId: z.string().uuid()
});

const testConnectionBodySchema = z.object({ timeoutMs: z.number().int().positive().max(10000).optional() });
const runIdParamsSchema = z.object({ runId: z.string().uuid() });
const llmProviderSchema = z.enum(["openai", "anthropic"]);
const llmConfigCreateSchema = z.object({
  provider: llmProviderSchema,
  model: z.string().trim().min(1).max(120),
  apiKey: z.string().trim().min(8),
  baseUrl: z.string().url().optional(),
  timeoutMs: z.number().int().min(1000).max(120000).default(30000),
  status: z.enum(["inactive", "active", "error"]).default("inactive")
});
const llmConfigUpdateSchema = z.object({
  provider: llmProviderSchema.optional(),
  model: z.string().trim().min(1).max(120).optional(),
  apiKey: z.string().trim().min(8).optional(),
  baseUrl: z.string().url().nullable().optional(),
  timeoutMs: z.number().int().min(1000).max(120000).optional(),
  status: z.enum(["inactive", "active", "error"]).optional(),
  isActive: z.boolean().optional()
});
const llmConfigIdParamsSchema = z.object({ configId: z.string().uuid() });

function normalizeAllowedDomains(rawDomains: string[]): string[] {
  const normalized = rawDomains
    .map((domain) => domain.trim().toLowerCase())
    .filter((domain) => domain.length > 0)
    .map((domain) => {
      try {
        const asUrl = new URL(domain.startsWith("http") ? domain : `https://${domain}`);
        return asUrl.hostname;
      } catch {
        return domain;
      }
    });

  return Array.from(new Set(normalized));
}

async function ensureProjectInOrg(projectId: string, organizationId: string) {
  return projectRepository.findByIdForOrganization(projectId, organizationId);
}

export const protectedRouter = Router();
protectedRouter.use(requireAuth);

protectedRouter.get("/personas", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) return void res.status(401).json({ error: "Unauthorized" });
  const personas = await personaRepository.listByOrganization(user.organizationId);
  res.json({ personas });
});

protectedRouter.get("/personas/:personaId", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) return void res.status(401).json({ error: "Unauthorized" });
  const params = personaIdParamsSchema.safeParse(req.params);
  if (!params.success) return void res.status(400).json({ error: "Invalid persona id" });
  const persona = await personaRepository.findByIdForOrganization(params.data.personaId, user.organizationId);
  if (!persona) return void res.status(404).json({ error: "Persona not found" });
  res.json({ persona });
});

protectedRouter.post("/personas", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) return void res.status(401).json({ error: "Unauthorized" });
  const parsed = personaCreateSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Invalid persona payload" });

  try {
    const persona = await personaRepository.createForOrganization(user.organizationId, parsed.data);
    res.status(201).json({ persona });
  } catch {
    res.status(409).json({ error: "Persona with this name already exists" });
  }
});

protectedRouter.patch("/personas/:personaId", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) return void res.status(401).json({ error: "Unauthorized" });

  const params = personaIdParamsSchema.safeParse(req.params);
  const parsed = personaUpdateSchema.safeParse(req.body);
  if (!params.success || !parsed.success) {
    return void res.status(400).json({ error: "Invalid persona update payload" });
  }

  try {
    const update = await personaRepository.updateForOrganization(
      params.data.personaId,
      user.organizationId,
      parsed.data
    );

    if (update.count === 0) return void res.status(404).json({ error: "Persona not found" });

    const persona = await personaRepository.findByIdForOrganization(params.data.personaId, user.organizationId);
    res.json({ persona });
  } catch {
    res.status(409).json({ error: "Persona with this name already exists" });
  }
});

protectedRouter.delete("/personas/:personaId", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) return void res.status(401).json({ error: "Unauthorized" });
  const params = personaIdParamsSchema.safeParse(req.params);
  if (!params.success) return void res.status(400).json({ error: "Invalid persona id" });
  const result = await personaRepository.deleteForOrganization(params.data.personaId, user.organizationId);
  if (result.count === 0) return void res.status(404).json({ error: "Persona not found" });
  res.json({ success: true });
});

protectedRouter.get("/projects", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const projects = await projectRepository.listByOrganization(user.organizationId);
  res.json({ projects });
});

protectedRouter.get("/projects/:projectId", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parseResult = idParamsSchema.safeParse(req.params);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid project id" });
    return;
  }

  const project = await projectRepository.findByIdForOrganization(
    parseResult.data.projectId,
    user.organizationId
  );

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({ project });
});

protectedRouter.post("/projects", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parseResult = projectCreateSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid project payload" });
    return;
  }

  try {
    const project = await projectRepository.create({
      organizationId: user.organizationId,
      name: parseResult.data.name
    });

    res.status(201).json({ project });
  } catch {
    res.status(409).json({ error: "Project with this name already exists" });
  }
});

protectedRouter.patch("/projects/:projectId", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const paramsResult = idParamsSchema.safeParse(req.params);
  const bodyResult = projectUpdateSchema.safeParse(req.body);

  if (!paramsResult.success || !bodyResult.success) {
    res.status(400).json({ error: "Invalid project update payload" });
    return;
  }

  try {
    const result = await projectRepository.updateForOrganization(
      paramsResult.data.projectId,
      user.organizationId,
      bodyResult.data
    );

    if (result.count === 0) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const updatedProject = await projectRepository.findByIdForOrganization(
      paramsResult.data.projectId,
      user.organizationId
    );

    res.json({ project: updatedProject });
  } catch {
    res.status(409).json({ error: "Project with this name already exists" });
  }
});

protectedRouter.delete("/projects/:projectId", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const paramsResult = idParamsSchema.safeParse(req.params);
  if (!paramsResult.success) {
    res.status(400).json({ error: "Invalid project id" });
    return;
  }

  const result = await projectRepository.deleteForOrganization(
    paramsResult.data.projectId,
    user.organizationId
  );

  if (result.count === 0) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({ success: true });
});

protectedRouter.get("/projects/:projectId/environments", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const paramsResult = idParamsSchema.safeParse(req.params);
  if (!paramsResult.success) {
    res.status(400).json({ error: "Invalid project id" });
    return;
  }

  const project = await ensureProjectInOrg(paramsResult.data.projectId, user.organizationId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const environments = await environmentRepository.listByProjectForOrganization(
    project.id,
    user.organizationId
  );

  res.json({ environments });
});

protectedRouter.post("/projects/:projectId/environments", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const paramsResult = idParamsSchema.safeParse(req.params);
  const bodyResult = environmentCreateSchema.safeParse(req.body);

  if (!paramsResult.success || !bodyResult.success) {
    res.status(400).json({ error: "Invalid environment payload" });
    return;
  }

  const project = await ensureProjectInOrg(paramsResult.data.projectId, user.organizationId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const normalizedAllowedDomains = normalizeAllowedDomains(bodyResult.data.allowedDomains);

  try {
    const environment = await environmentRepository.create({
      organizationId: user.organizationId,
      projectId: project.id,
      name: bodyResult.data.name,
      baseUrl: bodyResult.data.baseUrl,
      type: bodyResult.data.type as EnvironmentType,
      allowedDomains: normalizedAllowedDomains,
      status: bodyResult.data.status as EnvironmentStatus
    });

    res.status(201).json({ environment });
  } catch {
    res.status(409).json({ error: "Environment with this name already exists in project" });
  }
});

protectedRouter.patch(
  "/projects/:projectId/environments/:environmentId",
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const paramsResult = environmentParamsSchema.safeParse(req.params);
    const bodyResult = environmentUpdateSchema.safeParse(req.body);

    if (!paramsResult.success || !bodyResult.success) {
      res.status(400).json({ error: "Invalid environment update payload" });
      return;
    }

    const project = await ensureProjectInOrg(paramsResult.data.projectId, user.organizationId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const input = {
      ...bodyResult.data,
      allowedDomains: bodyResult.data.allowedDomains
        ? normalizeAllowedDomains(bodyResult.data.allowedDomains)
        : undefined
    };

    try {
      const result = await environmentRepository.updateForProjectAndOrganization(
        paramsResult.data.environmentId,
        paramsResult.data.projectId,
        user.organizationId,
        input
      );

      if (result.count === 0) {
        res.status(404).json({ error: "Environment not found" });
        return;
      }

      const environment = await environmentRepository.findByIdForProjectAndOrganization(
        paramsResult.data.environmentId,
        paramsResult.data.projectId,
        user.organizationId
      );

      res.json({ environment });
    } catch {
      res.status(409).json({ error: "Environment with this name already exists in project" });
    }
  }
);

protectedRouter.delete(
  "/projects/:projectId/environments/:environmentId",
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const paramsResult = environmentParamsSchema.safeParse(req.params);

    if (!paramsResult.success) {
      res.status(400).json({ error: "Invalid environment id" });
      return;
    }

    const result = await environmentRepository.deleteForProjectAndOrganization(
      paramsResult.data.environmentId,
      paramsResult.data.projectId,
      user.organizationId
    );

    if (result.count === 0) {
      res.status(404).json({ error: "Environment not found" });
      return;
    }

    res.json({ success: true });
  }
);

protectedRouter.post(
  "/projects/:projectId/environments/:environmentId/test-connection",
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const paramsResult = environmentParamsSchema.safeParse(req.params);
    const bodyResult = testConnectionBodySchema.safeParse(req.body ?? {});

    if (!paramsResult.success || !bodyResult.success) {
      res.status(400).json({ error: "Invalid test connection request" });
      return;
    }

    const environment = await environmentRepository.findByIdForProjectAndOrganization(
      paramsResult.data.environmentId,
      paramsResult.data.projectId,
      user.organizationId
    );

    if (!environment) {
      res.status(404).json({ error: "Environment not found" });
      return;
    }

    const timeoutMs = bodyResult.data.timeoutMs ?? 5000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(environment.baseUrl, { method: "GET", signal: controller.signal });
      clearTimeout(timeout);
      res.json({ ok: response.ok, statusCode: response.status, checkedAt: new Date().toISOString() });
    } catch (error) {
      clearTimeout(timeout);
      res.json({
        ok: false,
        statusCode: null,
        checkedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Request failed"
      });
    }
  }
);




const testAccountParamsSchema = z.object({ environmentId: z.string().uuid(), accountId: z.string().uuid() });
const reserveBodySchema = z.object({ runId: z.string().uuid(), agentId: z.string().uuid() });

const testAccountApiCreateSchema = testAccountSchema
  .extend({
    plainTextPassword: z.string().min(1).optional()
  })
  .refine((data) => Boolean(data.passwordSecretRef) || Boolean(data.encryptedPassword) || Boolean(data.plainTextPassword), {
    message: "Either passwordSecretRef, encryptedPassword, or plainTextPassword is required"
  })
  .transform((data) => {
    if (data.plainTextPassword && !data.encryptedPassword) {
      return {
        ...data,
        encryptedPassword: encryptSecret(data.plainTextPassword)
      };
    }
    return data;
  });

const testAccountApiUpdateSchema = testAccountUpdateSchema.extend({
  plainTextPassword: z.string().min(1).optional()
}).transform((data) => {
  if (data.plainTextPassword) {
    return {
      ...data,
      encryptedPassword: encryptSecret(data.plainTextPassword)
    };
  }
  return data;
});

protectedRouter.get("/environments/:environmentId/test-accounts", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) return void res.status(401).json({ error: "Unauthorized" });

  const parsed = z.object({ environmentId: z.string().uuid() }).safeParse(req.params);
  if (!parsed.success) return void res.status(400).json({ error: "Invalid environment id" });

  const environment = await environmentRepository.listByOrganization(user.organizationId);
  if (!environment.find((item) => item.id === parsed.data.environmentId)) {
    return void res.status(404).json({ error: "Environment not found" });
  }

  const accounts = await testAccountRepository.listByEnvironmentForOrganization(
    parsed.data.environmentId,
    user.organizationId
  );

  res.json({
    testAccounts: accounts.map((account) => ({
      ...account,
      encryptedPassword: account.encryptedPassword ? "[redacted]" : null
    }))
  });
});

protectedRouter.post("/environments/:environmentId/test-accounts", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) return void res.status(401).json({ error: "Unauthorized" });

  const envParsed = z.object({ environmentId: z.string().uuid() }).safeParse(req.params);
  if (!envParsed.success) return void res.status(400).json({ error: "Invalid environment id" });

  const parsed = testAccountApiCreateSchema.safeParse({ ...req.body, environmentId: envParsed.data.environmentId });
  if (!parsed.success) return void res.status(400).json({ error: "Invalid test account payload" });

  try {
    const created = await testAccountRepository.createForOrganization(user.organizationId, {
      environmentId: parsed.data.environmentId,
      label: parsed.data.label,
      username: parsed.data.username,
      email: parsed.data.email,
      role: parsed.data.role,
      passwordSecretRef: parsed.data.passwordSecretRef,
      encryptedPassword: parsed.data.encryptedPassword,
      allowConcurrentUse: parsed.data.allowConcurrentUse,
      status: parsed.data.status,
      notes: parsed.data.notes
    });

    res.status(201).json({ testAccount: { ...created, encryptedPassword: created.encryptedPassword ? "[redacted]" : null } });
  } catch {
    res.status(409).json({ error: "Duplicate username or email in this environment" });
  }
});

protectedRouter.post("/environments/:environmentId/test-accounts/import", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) return void res.status(401).json({ error: "Unauthorized" });

  const envParsed = z.object({ environmentId: z.string().uuid() }).safeParse(req.params);
  if (!envParsed.success) return void res.status(400).json({ error: "Invalid environment id" });

  const importItemSchema = testAccountSchema
    .omit({ environmentId: true })
    .extend({ plainTextPassword: z.string().min(1).optional() })
    .refine(
      (data) =>
        Boolean(data.passwordSecretRef) ||
        Boolean(data.encryptedPassword) ||
        Boolean(data.plainTextPassword),
      {
        message: "Either passwordSecretRef, encryptedPassword, or plainTextPassword is required"
      }
    )
    .transform((data) => {
      if (data.plainTextPassword && !data.encryptedPassword) {
        return { ...data, encryptedPassword: encryptSecret(data.plainTextPassword) };
      }
      return data;
    });
  const listSchema = z.array(importItemSchema);
  const parsed = listSchema.safeParse(req.body?.accounts);
  if (!parsed.success) return void res.status(400).json({ error: "Invalid import payload" });

  try {
    const created = await testAccountRepository.bulkCreateForOrganization(
      user.organizationId,
      parsed.data.map((item) => ({
        environmentId: envParsed.data.environmentId,
        label: item.label,
        username: item.username,
        email: item.email,
        role: item.role,
        passwordSecretRef: item.passwordSecretRef,
        encryptedPassword: item.encryptedPassword,
        allowConcurrentUse: item.allowConcurrentUse,
        status: item.status,
        notes: item.notes
      }))
    );

    res.status(201).json({ count: created.length });
  } catch {
    res.status(409).json({ error: "Import contains duplicate username or email in this environment" });
  }
});

protectedRouter.patch("/environments/:environmentId/test-accounts/:accountId", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) return void res.status(401).json({ error: "Unauthorized" });

  const parsedParams = testAccountParamsSchema.safeParse(req.params);
  if (!parsedParams.success) return void res.status(400).json({ error: "Invalid account id" });

  const parsed = testAccountApiUpdateSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Invalid test account update payload" });

  const updatePayload = { ...parsed.data } as Record<string, unknown>;
  delete updatePayload.plainTextPassword;
  const result = await testAccountRepository.updateForOrganization(parsedParams.data.accountId, user.organizationId, updatePayload);
  if (result.count === 0) return void res.status(404).json({ error: "Test account not found" });
  res.json({ success: true });
});

protectedRouter.delete("/environments/:environmentId/test-accounts/:accountId", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) return void res.status(401).json({ error: "Unauthorized" });

  const parsedParams = testAccountParamsSchema.safeParse(req.params);
  if (!parsedParams.success) return void res.status(400).json({ error: "Invalid account id" });

  const result = await testAccountRepository.deleteForOrganization(parsedParams.data.accountId, user.organizationId);
  if (result.count === 0) return void res.status(404).json({ error: "Test account not found" });
  res.json({ success: true });
});

protectedRouter.post("/test-accounts/:accountId/reserve", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) return void res.status(401).json({ error: "Unauthorized" });

  const accountParams = z.object({ accountId: z.string().uuid() }).safeParse(req.params);
  const bodyParsed = reserveBodySchema.safeParse(req.body);
  if (!accountParams.success || !bodyParsed.success) {
    return void res.status(400).json({ error: "Invalid reserve payload" });
  }

  const reserveResult = await testAccountRepository.reserveAccountForRun({
    testAccountId: accountParams.data.accountId,
    organizationId: user.organizationId,
    runId: bodyParsed.data.runId,
    agentId: bodyParsed.data.agentId
  });

  if (!reserveResult.ok) {
    return void res.status(409).json({ error: reserveResult.reason === "NOT_FOUND" ? "Test account not found" : "Test account is already reserved" });
  }

  res.json({ success: true });
});

protectedRouter.post("/test-accounts/:accountId/release", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) return void res.status(401).json({ error: "Unauthorized" });

  const accountParams = z.object({ accountId: z.string().uuid() }).safeParse(req.params);
  const bodyParsed = reserveBodySchema.safeParse(req.body);
  if (!accountParams.success || !bodyParsed.success) {
    return void res.status(400).json({ error: "Invalid release payload" });
  }

  const releaseResult = await testAccountRepository.releaseAccountReservation({
    testAccountId: accountParams.data.accountId,
    organizationId: user.organizationId,
    runId: bodyParsed.data.runId,
    agentId: bodyParsed.data.agentId
  });

  if (!releaseResult.ok) {
    return void res.status(404).json({ error: "Test account not found" });
  }

  res.json({ success: true });
});







const workflowParamsSchema = z.object({ projectId: z.string().uuid(), workflowId: z.string().uuid() });

protectedRouter.get("/projects/:projectId/workflows", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) return void res.status(401).json({ error: "Unauthorized" });

  const paramsResult = idParamsSchema.safeParse(req.params);
  if (!paramsResult.success) return void res.status(400).json({ error: "Invalid project id" });

  const project = await ensureProjectInOrg(paramsResult.data.projectId, user.organizationId);
  if (!project) return void res.status(404).json({ error: "Project not found" });

  const workflows = await workflowRepository.listByProjectForOrganization(project.id, user.organizationId);
  res.json({ workflows });
});

protectedRouter.post("/projects/:projectId/workflows", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) return void res.status(401).json({ error: "Unauthorized" });

  const paramsResult = idParamsSchema.safeParse(req.params);
  if (!paramsResult.success) return void res.status(400).json({ error: "Invalid project id" });

  const project = await ensureProjectInOrg(paramsResult.data.projectId, user.organizationId);
  if (!project) return void res.status(404).json({ error: "Project not found" });

  const parsed = workflowCreateSchema.safeParse({ ...req.body, projectId: paramsResult.data.projectId });
  if (!parsed.success) return void res.status(400).json({ error: "Invalid workflow payload" });

  try {
    const workflow = await workflowRepository.createForOrganization(user.organizationId, parsed.data);
    res.status(201).json({ workflow });
  } catch {
    res.status(409).json({ error: "Workflow with this name already exists in project" });
  }
});

protectedRouter.patch(
  "/projects/:projectId/workflows/:workflowId",
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) return void res.status(401).json({ error: "Unauthorized" });

    const paramsResult = workflowParamsSchema.safeParse(req.params);
    if (!paramsResult.success) return void res.status(400).json({ error: "Invalid workflow id" });

    const project = await ensureProjectInOrg(paramsResult.data.projectId, user.organizationId);
    if (!project) return void res.status(404).json({ error: "Project not found" });

    const parsed = workflowUpdateSchema.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: "Invalid workflow update payload" });

    try {
      const result = await workflowRepository.updateForOrganization(
        paramsResult.data.workflowId,
        user.organizationId,
        parsed.data
      );

      if (result.count === 0) return void res.status(404).json({ error: "Workflow not found" });

      const workflow = await workflowRepository.findByIdForOrganization(
        paramsResult.data.workflowId,
        user.organizationId
      );
      res.json({ workflow });
    } catch {
      res.status(409).json({ error: "Workflow with this name already exists in project" });
    }
  }
);

protectedRouter.delete(
  "/projects/:projectId/workflows/:workflowId",
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) return void res.status(401).json({ error: "Unauthorized" });

    const paramsResult = workflowParamsSchema.safeParse(req.params);
    if (!paramsResult.success) return void res.status(400).json({ error: "Invalid workflow id" });

    const result = await workflowRepository.deleteForOrganization(
      paramsResult.data.workflowId,
      user.organizationId
    );

    if (result.count === 0) return void res.status(404).json({ error: "Workflow not found" });
    res.json({ success: true });
  }
);


protectedRouter.get("/run-setup/options", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) return void res.status(401).json({ error: "Unauthorized" });

  const projects = await projectRepository.listByOrganization(user.organizationId);
  const personas = await personaRepository.listByOrganization(user.organizationId);
  const budgetPolicies = await budgetPolicyRepository.listByOrganization(user.organizationId);

  res.json({ projects, personas, budgetPolicies });
});

protectedRouter.get("/llm/providers", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) return void res.status(401).json({ error: "Unauthorized" });

  const configs = await llmProviderConfigRepository.listByOrganization(user.organizationId);
  res.json({
    configs: configs.map((config) => ({
      ...config,
      encryptedApiKey: undefined,
      hasApiKey: true
    }))
  });
});

protectedRouter.post("/llm/providers", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) return void res.status(401).json({ error: "Unauthorized" });

  const parsed = llmConfigCreateSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Invalid provider config payload" });

  const created = await llmProviderConfigRepository.create({
    organizationId: user.organizationId,
    provider: parsed.data.provider,
    model: parsed.data.model,
    encryptedApiKey: encryptSecret(parsed.data.apiKey),
    baseUrl: parsed.data.baseUrl,
    timeoutMs: parsed.data.timeoutMs,
    status: parsed.data.status,
    isActive: true
  });

  res.status(201).json({
    config: {
      ...created,
      encryptedApiKey: undefined,
      hasApiKey: true
    }
  });
});

protectedRouter.patch("/llm/providers/:configId", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) return void res.status(401).json({ error: "Unauthorized" });

  const params = llmConfigIdParamsSchema.safeParse(req.params);
  const parsed = llmConfigUpdateSchema.safeParse(req.body);
  if (!params.success || !parsed.success) {
    return void res.status(400).json({ error: "Invalid provider update payload" });
  }

  const updatePayload: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.apiKey) {
    updatePayload.encryptedApiKey = encryptSecret(parsed.data.apiKey);
    delete updatePayload.apiKey;
  }

  const result = await llmProviderConfigRepository.updateForOrganization(
    params.data.configId,
    user.organizationId,
    updatePayload
  );

  if (result.count === 0) return void res.status(404).json({ error: "Provider config not found" });

  const updated = await llmProviderConfigRepository.findByIdForOrganization(params.data.configId, user.organizationId);
  res.json({
    config: updated
      ? {
          ...updated,
          encryptedApiKey: undefined,
          hasApiKey: true
        }
      : null
  });
});

protectedRouter.post("/llm/providers/:configId/test", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) return void res.status(401).json({ error: "Unauthorized" });

  const params = llmConfigIdParamsSchema.safeParse(req.params);
  if (!params.success) return void res.status(400).json({ error: "Invalid provider config id" });

  const config = await llmProviderConfigRepository.findByIdForOrganization(params.data.configId, user.organizationId);
  if (!config) return void res.status(404).json({ error: "Provider config not found" });

  try {
    const provider = createLlmProvider({
      provider: config.provider as "openai" | "anthropic",
      model: config.model,
      apiKey: decryptSecret(config.encryptedApiKey),
      baseUrl: config.baseUrl ?? undefined,
      timeoutMs: config.timeoutMs ?? undefined
    });

    const completion = await provider.complete({
      prompt: "Return the single word: pong",
      temperature: 0,
      maxTokens: 12,
      responseFormat: "text"
    });

    await llmProviderConfigRepository.updateForOrganization(config.id, user.organizationId, {
      status: "active",
      lastCheckedAt: new Date(),
      lastError: null
    });

    res.json({
      ok: true,
      response: {
        text: completion.text,
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
        estimatedCost: completion.estimatedCost
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown provider error";
    await llmProviderConfigRepository.updateForOrganization(config.id, user.organizationId, {
      status: "error",
      lastCheckedAt: new Date(),
      lastError: message.slice(0, 500)
    });
    res.status(400).json({ ok: false, error: "Provider test failed", detail: message.slice(0, 300) });
  }
});

protectedRouter.post("/demo-runs/20-agent", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) return void res.status(401).json({ error: "Unauthorized" });

  const projects = await projectRepository.listByOrganization(user.organizationId);
  const project = projects[0];
  if (!project) return void res.status(400).json({ error: "No project found for demo run" });

  const environment = (project.environments ?? [])[0];
  if (!environment) return void res.status(400).json({ error: "No environment found for demo run" });

  const workflows = await workflowRepository.listByProjectForOrganization(project.id, user.organizationId);
  const workflow = workflows.find((item) => item.status === "ACTIVE");
  if (!workflow) return void res.status(400).json({ error: "No ACTIVE workflow found for demo run" });

  const personas = await personaRepository.listByOrganization(user.organizationId);
  if (personas.length === 0) return void res.status(400).json({ error: "No personas found for demo run" });

  const personaByRole = {
    lowTechHealthcare: personas.find((persona) => {
      const role = `${persona.role} ${persona.industry}`.toLowerCase();
      return role.includes("health") || role.includes("nurse") || role.includes("clinical");
    }),
    powerUser: personas.find((persona) => persona.technicalProficiency >= 75),
    impatientUser: personas.find((persona) => persona.patience <= 35 || persona.timePressure >= 75),
    adminUser: personas.find((persona) => persona.role.toLowerCase().includes("admin")),
    mobileUser: personas.find((persona) =>
      persona.accessibilityNeeds.some((need) => need.toLowerCase().includes("touch"))
    )
  };

  const archetypePool = [
    personaByRole.lowTechHealthcare,
    personaByRole.powerUser,
    personaByRole.impatientUser,
    personaByRole.adminUser,
    personaByRole.mobileUser
  ].filter((persona): persona is NonNullable<typeof persona> => Boolean(persona));

  const fallbackPersonas = personas.slice(0, 5);
  const pool = archetypePool.length > 0 ? archetypePool : fallbackPersonas;
  if (pool.length === 0) return void res.status(400).json({ error: "Unable to build persona pool" });

  const accounts = await testAccountRepository.listByEnvironmentForOrganization(
    environment.id,
    user.organizationId
  );

  const available = accounts.filter((account) => {
    if (account.status !== "AVAILABLE") return false;
    if (account.allowConcurrentUse) return true;
    return account.reservations.length === 0;
  });

  if (available.length < 20) {
    return void res.status(400).json({ error: "Need at least 20 available test accounts for demo run" });
  }

  const selectedAccounts = available.slice(0, 20);
  const assignedPersonaIds = Array.from({ length: 20 }, (_, index) => pool[index % pool.length].id);

  const run = await runRepository.createPending({
    organizationId: user.organizationId,
    projectId: project.id,
    environmentId: environment.id,
    workflowId: workflow.id,
    createdByUserId: user.id,
    selectedPersonaIds: assignedPersonaIds,
    selectedTestAccountIds: selectedAccounts.map((account) => account.id),
    requestedAgentCount: 20,
    maxRunDurationSeconds: 600
  });

  await runRepository.updateStatus(run.id, RunStatus.RUNNING);
  const runStartedEvent = await eventRepository.create({
    organizationId: user.organizationId,
    runId: run.id,
    eventType: "run.started",
    payload: { preset: "20-agent-demo", requestedAgents: 20 }
  });
  emitRunEvent(run.id, runStartedEvent);

  const agentRecords = [];
  for (let index = 0; index < 20; index += 1) {
    const agent = await runRepository.createAgent({
      simulationRunId: run.id,
      personaId: assignedPersonaIds[index],
      testAccountId: selectedAccounts[index].id,
      status: "IDLE",
      startedAt: null
    });
    agentRecords.push(agent);
  }

  await Promise.all(
    agentRecords.map((agent) => enqueueAgentJob({ runId: run.id, agentId: agent.id }))
  );

  res.status(201).json({ run, agentsCreated: agentRecords.length });
});

protectedRouter.post("/simulation-runs", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) return void res.status(401).json({ error: "Unauthorized" });

  const parsed = runSetupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid run configuration" });
    return;
  }

  const input = parsed.data;

  const project = await projectRepository.findByIdForOrganization(input.projectId, user.organizationId);
  if (!project) return void res.status(400).json({ error: "Project not found" });

  const environment = await environmentRepository.findByIdForProjectAndOrganization(
    input.environmentId,
    input.projectId,
    user.organizationId
  );
  if (!environment) return void res.status(400).json({ error: "Environment not found in project" });

  const workflow = await workflowRepository.findByIdForOrganization(input.workflowId, user.organizationId);
  if (!workflow || workflow.projectId !== input.projectId) {
    return void res.status(400).json({ error: "Workflow not found in project" });
  }

  if ((workflow.status as WorkflowStatus) !== "ACTIVE") {
    return void res.status(400).json({ error: "Workflow must be ACTIVE" });
  }

  const allPersonas = await personaRepository.listByOrganization(user.organizationId);
  const personaIds = new Set(allPersonas.map((persona) => persona.id));
  if (!input.personaIds.every((id) => personaIds.has(id))) {
    return void res.status(400).json({ error: "One or more personas are invalid" });
  }

  const budgetPolicy = await budgetPolicyRepository.findByIdForOrganization(
    input.budgetPolicyId,
    user.organizationId
  );
  if (!budgetPolicy) return void res.status(400).json({ error: "Budget policy not found" });

  const selectedAccounts = await testAccountRepository.listByIdsForOrganization(
    input.testAccountIds,
    user.organizationId
  );

  const selectedInEnvironment = selectedAccounts.filter(
    (account) => account.environmentId === input.environmentId
  );

  if (selectedInEnvironment.length !== input.testAccountIds.length) {
    return void res.status(400).json({ error: "All test accounts must belong to selected environment" });
  }

  const availableAccounts = selectedInEnvironment.filter((account) => {
    if (account.status === "DISABLED") return false;
    if (account.allowConcurrentUse) return true;
    return account.reservations.length === 0 && account.status === "AVAILABLE";
  });

  if (availableAccounts.length < input.agentCount) {
    return void res.status(400).json({ error: "Not enough available test accounts for requested agent count" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(environment.baseUrl, { method: "GET", signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) {
      return void res.status(400).json({ error: "Environment is not reachable" });
    }
  } catch {
    clearTimeout(timeout);
    return void res.status(400).json({ error: "Environment is not reachable" });
  }

  if (input.personaIds.length < 1) {
    return void res.status(400).json({ error: "At least one persona is required" });
  }

  const run = await runRepository.createPending({
    organizationId: user.organizationId,
    projectId: input.projectId,
    environmentId: input.environmentId,
    workflowId: input.workflowId,
    budgetPolicyId: input.budgetPolicyId,
    createdByUserId: user.id,
    selectedPersonaIds: input.personaIds,
    selectedTestAccountIds: input.testAccountIds,
    requestedAgentCount: input.agentCount,
    maxRunDurationSeconds: input.maxRunDurationSeconds
  });

  await enqueueSimulationRun(run.id);
  res.status(201).json({ run });
});

protectedRouter.post("/simulation-runs/:runId/cancel", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) return void res.status(401).json({ error: "Unauthorized" });

  const params = runIdParamsSchema.safeParse(req.params);
  if (!params.success) return void res.status(400).json({ error: "Invalid run id" });

  const run = await runRepository.getById(params.data.runId);
  if (!run || run.organizationId !== user.organizationId) {
    return void res.status(404).json({ error: "Run not found" });
  }

  await runRepository.updateStatus(run.id, RunStatus.CANCELED);
  await cancelRunJobs(run.id);
  res.json({ success: true });
});

protectedRouter.post("/events", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) return void res.status(401).json({ error: "Unauthorized" });

  const parsed = simulationEventSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Invalid event payload" });

  const run = await runRepository.getById(parsed.data.runId);
  if (!run || run.organizationId !== user.organizationId) {
    return void res.status(404).json({ error: "Run not found" });
  }

  if (parsed.data.agentId) {
    const agent = await runRepository.getAgentById(parsed.data.agentId);
    if (!agent || agent.simulationRunId !== run.id) {
      return void res.status(400).json({ error: "Agent does not belong to run" });
    }
  }

  if (parsed.data.personaId) {
    const persona = await personaRepository.findByIdForOrganization(parsed.data.personaId, user.organizationId);
    if (!persona) return void res.status(400).json({ error: "Persona not found" });
  }

  const event = await eventRepository.create({
    organizationId: user.organizationId,
    runId: parsed.data.runId,
    agentId: parsed.data.agentId,
    personaId: parsed.data.personaId,
    eventType: parsed.data.eventType,
    severity: parsed.data.severity,
    payload: parsed.data.payload,
    timestamp: parsed.data.timestamp
  });

  emitRunEvent(parsed.data.runId, event);
  res.status(201).json({ event });
});

protectedRouter.get("/runs/:runId/events", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) return void res.status(401).json({ error: "Unauthorized" });

  const params = runIdParamsSchema.safeParse(req.params);
  if (!params.success) return void res.status(400).json({ error: "Invalid run id" });

  const run = await runRepository.getById(params.data.runId);
  if (!run || run.organizationId !== user.organizationId) {
    return void res.status(404).json({ error: "Run not found" });
  }

  const events = await eventRepository.listByRunForOrganization(params.data.runId, user.organizationId);
  res.json({ events });
});

protectedRouter.get("/runs/:runId/artifacts", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) return void res.status(401).json({ error: "Unauthorized" });

  const params = runIdParamsSchema.safeParse(req.params);
  if (!params.success) return void res.status(400).json({ error: "Invalid run id" });

  const run = await runRepository.getById(params.data.runId);
  if (!run || run.organizationId !== user.organizationId) {
    return void res.status(404).json({ error: "Run not found" });
  }

  const artifacts = await artifactRepository.listByRunForOrganization(params.data.runId, user.organizationId);
  res.json({ artifacts });
});
