import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { getWorkspaceRunsDirectory } from "./paths.js";
import { resolveStoredArtifactLocator, toStoredArtifactLocator } from "./artifact-storage.js";

test("toStoredArtifactLocator converts approved run file paths to relative locators", () => {
  const absolute = path.join(getWorkspaceRunsDirectory(), "run-1", "agent-1", "shot.png");
  assert.equal(toStoredArtifactLocator(absolute), "run-1/agent-1/shot.png");
});

test("toStoredArtifactLocator rejects paths outside the approved runs directory", () => {
  assert.throws(() => toStoredArtifactLocator(path.resolve(getWorkspaceRunsDirectory(), "..", "secret.txt")));
});

test("resolveStoredArtifactLocator rejects traversal attempts", () => {
  assert.throws(() => resolveStoredArtifactLocator("../secret.txt"));
});
