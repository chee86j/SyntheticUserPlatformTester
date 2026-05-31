import { EnvironmentRepository, ProjectRepository } from "@synthetic/database";
import type { EnvironmentStatus, EnvironmentType } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../middleware/require-auth.js";

const projectRepository = new ProjectRepository();
const environmentRepository = new EnvironmentRepository();

const projectCreateSchema = z.object({
  name: z.string().trim().min(1).max(120)
});

const projectUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120)
});

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

const idParamsSchema = z.object({
  projectId: z.string().uuid()
});

const environmentParamsSchema = z.object({
  projectId: z.string().uuid(),
  environmentId: z.string().uuid()
});

const testConnectionBodySchema = z.object({
  timeoutMs: z.number().int().positive().max(10000).optional()
});

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
      const response = await fetch(environment.baseUrl, {
        method: "GET",
        signal: controller.signal
      });
      clearTimeout(timeout);

      res.json({
        ok: response.ok,
        statusCode: response.status,
        checkedAt: new Date().toISOString()
      });
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
