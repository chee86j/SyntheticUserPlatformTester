import { EnvironmentRepository, PersonaRepository, ProjectRepository, TestAccountRepository } from "@synthetic/database";
import { personaCreateSchema, personaUpdateSchema, testAccountSchema, testAccountUpdateSchema } from "@synthetic/shared";
import type { EnvironmentStatus, EnvironmentType } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../middleware/require-auth.js";
import { encryptSecret } from "../auth/secret-encryption.js";

const projectRepository = new ProjectRepository();
const environmentRepository = new EnvironmentRepository();
const personaRepository = new PersonaRepository();
const testAccountRepository = new TestAccountRepository();

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





