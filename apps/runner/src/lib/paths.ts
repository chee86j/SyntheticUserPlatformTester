import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const runnerRoot = path.resolve(currentDirectory, "..", "..");
const workspaceRoot = path.resolve(runnerRoot, "..", "..");

export function getWorkspaceRunsDirectory(): string {
  return path.join(workspaceRoot, "runs");
}

export function getRunDirectory(runId: string, agentId?: string): string {
  return agentId ? path.join(getWorkspaceRunsDirectory(), runId, agentId) : path.join(getWorkspaceRunsDirectory(), runId);
}
