import path from "node:path";
import { isAllowedUrl } from "@synthetic/shared";
import { chromium, type BrowserContext, type Page } from "playwright";
import { env } from "../lib/config.js";
import { AgentMemoryService } from "./agent-memory-service.js";
import { AgentPromptBuilder } from "./agent-prompt-builder.js";
import { LlmActionParser, type LlmAction } from "./llm-action-parser.js";
import { PageObservationService } from "./page-observation-service.js";
import { PersonaBehaviorService, type PersonaTraits } from "./persona-behavior-service.js";
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
  allowedDomains: string[];
  baseUrl: string;
  timeoutMs?: number | null;
}): Promise<{ completed: boolean; steps: number }> {
  const memory = new AgentMemoryService();
  const promptBuilder = new AgentPromptBuilder();
  const parser = new LlmActionParser();
  const observationService = new PageObservationService();
  const behaviorService = new PersonaBehaviorService();
  const executor = new SafeActionExecutor();
  const behaviorProfile = behaviorService.buildProfile(input.personaTraits as PersonaTraits | null);

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
      maxActionsRemaining: maxSteps - stepIndex,
      personaInstructions: behaviorProfile.promptInstructions,
      thresholds: behaviorProfile.thresholds
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
    const frustrationBefore = memory.frustrationScore();
    await input.emit({
      eventType: "action.started",
      payload: {
        action: action.action,
        target: action.target,
        reason: action.reason,
        confidence: action.confidence,
        frustrationScore: frustrationBefore,
        confusionScore: memory.confusionScore(),
        index: stepIndex
      }
    });

    memory.record({
      timestamp: new Date().toISOString(),
      action: action.action,
      target: action.target,
      result: "started",
      reason: action.reason,
      frustrationDelta: action.frustrationDelta,
      confidence: action.confidence
    });

    try {
      const adjustedAction = adjustActionForPersona(action, behaviorProfile.thresholds.maxWaitMs);
      const result = await executor.execute({
        page: input.page,
        action: adjustedAction,
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
        action: adjustedAction.action,
        target: adjustedAction.target,
        result: "completed",
        reason: adjustedAction.reason,
        frustrationDelta: behaviorService.estimateFrustrationDelta({
          action: adjustedAction.action,
          success: true,
          confidence: adjustedAction.confidence,
          durationMs: Date.now() - startedAt,
          thresholds: behaviorProfile.thresholds
        }),
        confidence: adjustedAction.confidence
      });

      const frustrationAfter = memory.frustrationScore();
      if (frustrationAfter !== frustrationBefore) {
        await input.emit({
          eventType: "action.completed",
          severity: "INFO",
          payload: {
            action: "metric.frustration.changed",
            frustrationBefore,
            frustrationAfter,
            confusionScore: memory.confusionScore(),
            stepIndex
          }
        });
      }

      await input.emit({
        eventType: "action.completed",
        payload: {
          action: adjustedAction.action,
          target: adjustedAction.target,
          reason: adjustedAction.reason,
          confidence: adjustedAction.confidence,
          durationMs: Date.now() - startedAt,
          frustrationDelta: frustrationAfter - frustrationBefore,
          frustrationScore: frustrationAfter,
          confusionScore: memory.confusionScore(),
          index: stepIndex
        }
      });

      if (frustrationAfter >= behaviorProfile.thresholds.abandonmentThreshold) {
        await input.emit({
          eventType: "action.failed",
          severity: "WARNING",
          payload: {
            action: "abandonment.threshold",
            threshold: behaviorProfile.thresholds.abandonmentThreshold,
            frustrationScore: frustrationAfter,
            confusionScore: memory.confusionScore(),
            reason: "Persona abandoned workflow due to frustration"
          }
        });
        return { completed: false, steps: stepIndex + 1 };
      }

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
        frustrationDelta: behaviorService.estimateFrustrationDelta({
          action: action.action,
          success: false,
          confidence: action.confidence,
          durationMs: Date.now() - startedAt,
          thresholds: behaviorProfile.thresholds
        }),
        confidence: action.confidence
      });

      const mayRetry =
        behaviorProfile.thresholds.retryTendency >= 0.6 &&
        action.action !== "fail" &&
        action.action !== "finish";
      if (mayRetry) {
        await input.emit({
          eventType: "action.completed",
          severity: "WARNING",
          payload: {
            action: "metric.retry.attempted",
            originalAction: action.action,
            retryTendency: behaviorProfile.thresholds.retryTendency,
            frustrationScore: memory.frustrationScore(),
            confusionScore: memory.confusionScore(),
            index: stepIndex
          }
        });
      }

      await input.emit({
        eventType: "action.failed",
        severity: "ERROR",
        payload: {
          action: action.action,
          target: action.target,
          reason: action.reason,
          confidence: action.confidence,
          error: error instanceof Error ? error.message : "Action execution failed",
          frustrationDelta: memory.frustrationScore() - frustrationBefore,
          frustrationScore: memory.frustrationScore(),
          confusionScore: memory.confusionScore(),
          index: stepIndex
        }
      });
      if (mayRetry) {
        continue;
      }
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
  allowedDomains: string[];
  baseUrl: string;
  timeoutMs?: number | null;
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

    await context.route("**/*", async (route) => {
      const url = route.request().url();
      if (isAllowedUrl({ url, allowedDomains: input.allowedDomains, baseUrl: input.baseUrl })) {
        await route.continue();
        return;
      }

      await route.abort("blockedbyclient");
    });

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

    const result = await withTimeout(
      executeLlmDrivenWorkflow({
        page,
        runId: input.runId,
        agentId: input.agentId,
        runDir: input.runDir,
        workflow: input.workflow,
        personaTraits: input.personaTraits,
        llmComplete: input.llmComplete,
        emit: input.emit,
        onArtifact: input.onArtifact,
        maxActionsPerAgent: input.maxActionsPerAgent,
        allowedDomains: input.allowedDomains,
        baseUrl: input.baseUrl,
        timeoutMs: input.timeoutMs
      }),
      input.timeoutMs ?? null
    );

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

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number | null): Promise<T> {
  if (timeoutMs == null || timeoutMs <= 0) return promise;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`Agent exceeded timeout of ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function adjustActionForPersona(action: LlmAction, maxWaitMs: number): LlmAction {
  if (action.action !== "wait") return action;
  const requested = Number(action.target);
  if (!Number.isFinite(requested) || requested <= 0) {
    return { ...action, target: String(Math.min(1000, maxWaitMs)) };
  }
  return { ...action, target: String(Math.min(requested, maxWaitMs)) };
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
