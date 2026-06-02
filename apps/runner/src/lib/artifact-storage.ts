import path from "node:path";
import { getWorkspaceRunsDirectory } from "./paths.js";

export function toStoredArtifactLocator(absolutePath: string): string {
  const runsRoot = path.resolve(getWorkspaceRunsDirectory());
  const resolved = path.resolve(absolutePath);
  if (resolved !== runsRoot && !resolved.startsWith(`${runsRoot}${path.sep}`)) {
    throw new Error("Artifact path must stay within the approved runs directory");
  }

  return path.relative(runsRoot, resolved).split(path.sep).join("/");
}

export function resolveStoredArtifactLocator(locator: string): string {
  if (!locator || path.isAbsolute(locator)) {
    throw new Error("Artifact locator must be a non-empty relative path");
  }

  const runsRoot = path.resolve(getWorkspaceRunsDirectory());
  const resolved = path.resolve(runsRoot, locator);
  if (resolved !== runsRoot && !resolved.startsWith(`${runsRoot}${path.sep}`)) {
    throw new Error("Artifact locator escapes the approved runs directory");
  }

  return resolved;
}
