import { Router } from "express";
import { ProjectRepository } from "@synthetic/database";
import { requireAuth, type AuthenticatedRequest } from "../middleware/require-auth.js";

const projectRepository = new ProjectRepository();

export const protectedRouter = Router();

protectedRouter.get("/projects", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const projects = await projectRepository.listByOrganization(req.user.organizationId);
  res.json({ projects });
});
