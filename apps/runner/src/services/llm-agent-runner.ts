import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import { env } from "../lib/config.js";
import { AgentMemoryService } from "./agent-memory-service.js";
import { AgentPromptBuilder } from "./agent-prompt-builder.js";
import { LlmActionParser } from "./llm-action-parser.js";
import { PageObservationService } from "./page-observation-service.js";
import { SafeActionExecutor } from "./safe-action-executor.js";

type EmitFn = (input: {
  eventType:
    | "action.started"
    | "action.completed"
    | "action.failed"
    | "screenshot.captured"
    | "artifact.created"
    | "console.error"
    | "network.failed";
  severity?: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  payload: Record<string, unknown>;
}) => Promise<void>;

type ArtifactFn = (input: {
  type: "SCREENSHOT" | "TRACE" | "VIDEO" | "CONSOLE_LOG" | "NETWORK_LOG";
  uri: string;
}) => Promise<void>;

type LlmCompleteFn = (input: {
  prompt: string;
  runId: string;
  agentId: string;
}) => Promise<{ text?: string; parsedJson?: unknown }>;

export async function executeLlmDrivenWorkflow(input: {
  page: Page;
  runId: string;
  agentId: string;
  runDir: string;
  workflow: {
    goal: string;
    startingPath: string;
    maxSteps: number;
    successCriteria: unknown;
  };
  personaTraits: {
    name: string;
    role: string;
    industry: string;
    technicalProficiency: number;
    domainExpertise: number;
    timePressure: number;
    patience: number;
    confidence: number;
    errorRecovery: number;
    riskTolerance: number;
    accessibilityNeeds: string[];
    behaviorNotes: string;
  } | null;
  llmComplete: LlmCompleteFn;
  emit: EmitFn;
  onArtifact: ArtifactFn;
  maxActionsPerAgent?: number | null;
}): Promise<{ completed: boolean; steps: number }> {
  const memory = new AgentMemoryService();
  const promptBuilder = new AgentPromptBuilder();
  const parser = new LlmActionParser();
  const observationService = new PageObservationService();
  const executor = new SafeActionExecutor();

  const maxSteps = Math.min(input.workflow.maxSteps, input.maxActionsPerAgent ?? input.workflow.maxSteps);

  for (let stepIndex = 0; stepIndex < maxSteps; stepIndex += 1) {
    if (await isSuccessCriteriaMet(input.page, input.workflow.successCriteria)) {
      return { completed: true, steps: stepIndex };
    }

    const observation = await observationService.observe({
      page: input.page,
      workflowGoal: input.workflow.goal,
      personaTraits: input.personaTraits,
      memory
    });

    const prompt = promptBuilder.buildPrompt({
      observation,
      successCriteria: input.workflow.successCriteria,
      maxActionsRemaining: maxSteps - stepIndex
    });

    const llm = await input.llmComplete({ prompt, runId: input.runId, agentId: input.agentId });

    let action;
    try {
      action = parser.parse({ text: llm.text, parsedJson: llm.parsedJson });
    } catch (error) {
      const screenshotPath = await executor.captureFailureScreenshot(input.page, input.runDir, stepIndex);
      await input.emit({ eventType: "screenshot.captured", severity: "WARNING", payload: { uri: screenshotPath } });
      await input.emit({ eventType: "artifact.created", severity: "WARNING", payload: { type: "SCREENSHOT", uri: screenshotPath } });
      await input.onArtifact({ type: "SCREENSHOT", uri: screenshotPath });

      await input.emit({
        eventType: "action.failed",
        severity: "ERROR",
        payload: {
          action: "llm-parse",
          index: stepIndex,
          error: error instanceof Error ? error.message : "Invalid LLM action output"
        }
      });
      throw error;
    }

    const startedAt = Date.now();
    await input.emit({
      eventType: "action.started",
      payload: {
        action: action.action,
        target: action.target,
        reason: action.reason,
        confidence: action.confidence,
        frustrationScore: memory.frustrationScore(),
        index: stepIndex
      }
    });

    memory.record({
      timestamp: new Date().toISOString(),
      action: action.action,
      target: action.target,
      result: "started",
      reason: action.reason,
      frustrationDelta: action.frustrationDelta
    });

    try {
      const result = await executor.execute({
        page: input.page,
        action,
        runDir: input.runDir,
        stepIndex
      });

      if (result.screenshotPath) {
        await input.emit({ eventType: "screenshot.captured", payload: { uri: result.screenshotPath } });
        await input.emit({ eventType: "artifact.created", payload: { type: "SCREENSHOT", uri: result.screenshotPath } });
        await input.onArtifact({ type: "SCREENSHOT", uri: result.screenshotPath });
      }

      memory.record({
        timestamp: new Date().toISOString(),
        action: action.action,
        target: action.target,
        result: "completed",
        reason: action.reason,
        frustrationDelta: action.frustrationDelta
      });

      await input.emit({
        eventType: "action.completed",
        payload: {
          action: action.action,
          target: action.target,
          reason: action.reason,
          confidence: action.confidence,
          durationMs: Date.now() - startedAt,
          frustrationDelta: action.frustrationDelta,
          frustrationScore: memory.frustrationScore(),
          index: stepIndex
        }
      });

      if (result.terminal) {
        return { completed: result.success, steps: stepIndex + 1 };
      }
    } catch (error) {
      const screenshotPath = await executor.captureFailureScreenshot(input.page, input.runDir, stepIndex);
      await input.emit({ eventType: "screenshot.captured", severity: "WARNING", payload: { uri: screenshotPath } });
      await input.emit({ eventType: "artifact.created", severity: "WARNING", payload: { type: "SCREENSHOT", uri: screenshotPath } });
      await input.onArtifact({ type: "SCREENSHOT", uri: screenshotPath });

      memory.record({
        timestamp: new Date().toISOString(),
        action: action.action,
        target: action.target,
        result: "failed",
        reason: action.reason,
        frustrationDelta: action.frustrationDelta
      });

      await input.emit({
        eventType: "action.failed",
        severity: "ERROR",
        payload: {
          action: action.action,
          target: action.target,
          reason: action.reason,
          confidence: action.confidence,
          error: error instanceof Error ? error.message : "Action execution failed",
          frustrationDelta: action.frustrationDelta,
          frustrationScore: memory.frustrationScore(),
          index: stepIndex
        }
      });
      throw error;
    }
  }

  return { completed: await isSuccessCriteriaMet(input.page, input.workflow.successCriteria), steps: maxSteps };
}

export async function runSingleLlmAgent(input: {
  runId: string;
  agentId: string;
  runDir: string;
  startUrl: string;
  workflow: {
    goal: string;
    startingPath: string;
    maxSteps: number;
    successCriteria: unknown;
  };
  personaTraits: {
    name: string;
    role: string;
    industry: string;
    technicalProficiency: number;
    domainExpertise: number;
    timePressure: number;
    patience: number;
    confidence: number;
    errorRecovery: number;
    riskTolerance: number;
    accessibilityNeeds: string[];
    behaviorNotes: string;
  } | null;
  llmComplete: LlmCompleteFn;
  emit: EmitFn;
  onArtifact: ArtifactFn;
  maxActionsPerAgent?: number | null;
}): Promise<{ completed: boolean; steps: number }> {
  const browser = await chromium.launch({ headless: env.RUNNER_HEADLESS, slowMo: env.RUNNER_SLOW_MO_MS });
  let context: BrowserContext | null = null;
  try {
    context = await browser.newContext(
      env.RUNNER_RECORD_VIDEO
        ? {
            recordVideo: {
              dir: input.runDir,
              size: { width: 1280, height: 720 }
            }
          }
        : undefined
    );

    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    const page = await context.newPage();
    page.setDefaultTimeout(env.RUNNER_NAV_TIMEOUT_MS);

    page.on("console", async (message) => {
      if (message.type() === "error") {
        await input.emit({ eventType: "console.error", severity: "ERROR", payload: { message: message.text() } });
      }
    });

    page.on("response", async (response) => {
      if (response.status() >= 400) {
        await input.emit({
          eventType: "network.failed",
          severity: response.status() >= 500 ? "ERROR" : "WARNING",
          payload: { url: response.url(), status: response.status() }
        });
      }
    });

    await page.goto(input.startUrl, { waitUntil: "domcontentloaded" });

    const result = await executeLlmDrivenWorkflow({
      page,
      runId: input.runId,
      agentId: input.agentId,
      runDir: input.runDir,
      workflow: input.workflow,
      personaTraits: input.personaTraits,
      llmComplete: input.llmComplete,
      emit: input.emit,
      onArtifact: input.onArtifact,
      maxActionsPerAgent: input.maxActionsPerAgent
    });

    const tracePath = path.join(input.runDir, "trace.zip");
    await context.tracing.stop({ path: tracePath });
    await input.emit({ eventType: "artifact.created", payload: { type: "TRACE", uri: tracePath } });
    await input.onArtifact({ type: "TRACE", uri: tracePath });

    return result;
  } finally {
    if (context) {
      try {
        await context.close();
      } catch {
        // no-op
      }
    }
    await browser.close();
  }
}

async function isSuccessCriteriaMet(page: Page, successCriteria: unknown): Promise<boolean> {
  if (!Array.isArray(successCriteria) || successCriteria.length === 0) return false;

  for (const criterion of successCriteria) {
    if (typeof criterion !== "object" || criterion === null) continue;
    const type = (criterion as { type?: string }).type;
    const value = String((criterion as { value?: unknown }).value ?? "");
    if (!type || !value) continue;

    if (type === "URL_CONTAINS") {
      if (!page.url().includes(value)) return false;
      continue;
    }

    if (type === "PAGE_CONTAINS_TEXT") {
      const found = await page.getByText(value, { exact: false }).first().isVisible().catch(() => false);
      if (!found) return false;
      continue;
    }

    if (type === "ELEMENT_VISIBLE") {
      const byRole = await page.getByRole("button", { name: value, exact: false }).first().isVisible().catch(() => false);
      const byText = await page.getByText(value, { exact: false }).first().isVisible().catch(() => false);
      if (!byRole && !byText) return false;
      continue;
    }

    if (type === "MANUAL_NOTE") {
      continue;
    }

    if (type === "EVENT_EMITTED") {
      return false;
    }
  }

  return true;
}
