import path from "node:path";
import { isAllowedUrl } from "@synthetic/shared";
import { chromium, type BrowserContext, type Page } from "playwright";
import { env } from "./config.js";
import type { ScriptedAction } from "./actions.js";
import { blockedRequestPayload, isIgnorableConsoleError } from "./browser-event-filters.js";

export class ProductWorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductWorkflowError";
  }
}

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

type ArtifactFn = (input: { type: "SCREENSHOT" | "TRACE" | "VIDEO" | "CONSOLE_LOG" | "NETWORK_LOG"; uri: string }) => Promise<void>;

export async function executeScriptedWorkflow(input: {
  actions: ScriptedAction[];
  runDir: string;
  baseUrl: string;
  allowedDomains: string[];
  maxActions?: number | null;
  timeoutMs?: number | null;
  emit: EmitFn;
  onArtifact: ArtifactFn;
}): Promise<void> {
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

    await applyNetworkRestrictions(context, input.allowedDomains, input.baseUrl, input.emit);
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

    const page = await context.newPage();
    page.setDefaultTimeout(env.RUNNER_NAV_TIMEOUT_MS);

    page.on("console", async (message) => {
      const text = message.text();
      if (message.type() === "error" && !isIgnorableConsoleError(text)) {
        await input.emit({
          eventType: "console.error",
          severity: "ERROR",
          payload: { message: text }
        });
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

    const maxActions = input.maxActions == null ? input.actions.length : Math.min(input.actions.length, input.maxActions);
    await withTimeout(
      (async () => {
        for (let index = 0; index < maxActions; index += 1) {
          const action = input.actions[index];
          const startedAt = Date.now();
          await input.emit({ eventType: "action.started", payload: { action: action.type, index } });

          try {
            const metadata = await runAction(page, action, input.runDir, index);
            const durationMs = Date.now() - startedAt;

            await input.emit({
              eventType: "action.completed",
              payload: { action: action.type, index, durationMs, ...(metadata.pageLoadMs ? { pageLoadMs: metadata.pageLoadMs } : {}) }
            });

            if (metadata.screenshotPath) {
              await input.emit({ eventType: "screenshot.captured", payload: { uri: metadata.screenshotPath } });
              await input.emit({ eventType: "artifact.created", payload: { type: "SCREENSHOT", uri: metadata.screenshotPath } });
              await input.onArtifact({ type: "SCREENSHOT", uri: metadata.screenshotPath });
            }
          } catch (error) {
            const failureShot = path.join(input.runDir, `failed-step-${index + 1}.png`);
            await page.screenshot({ path: failureShot, fullPage: true });
            await input.emit({ eventType: "screenshot.captured", severity: "WARNING", payload: { uri: failureShot } });
            await input.emit({ eventType: "artifact.created", severity: "WARNING", payload: { type: "SCREENSHOT", uri: failureShot } });
            await input.onArtifact({ type: "SCREENSHOT", uri: failureShot });

            await input.emit({
              eventType: "action.failed",
              severity: "ERROR",
              payload: {
                action: action.type,
                index,
                error: error instanceof Error ? error.message : "Unknown action error"
              }
            });
            const message = error instanceof Error ? error.message : "Unknown action error";
            throw new ProductWorkflowError(message);
          }
        }
      })(),
      input.timeoutMs ?? null
    );

    const tracePath = path.join(input.runDir, "trace.zip");
    await context.tracing.stop({ path: tracePath });
    await input.emit({ eventType: "artifact.created", payload: { type: "TRACE", uri: tracePath } });
    await input.onArtifact({ type: "TRACE", uri: tracePath });

    if (env.RUNNER_RECORD_VIDEO) {
      const video = page.video();
      if (video) {
        const videoPath = await video.path();
        await input.emit({ eventType: "artifact.created", payload: { type: "VIDEO", uri: videoPath } });
        await input.onArtifact({ type: "VIDEO", uri: videoPath });
      }
    }

    await context.close();
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

async function applyNetworkRestrictions(
  context: BrowserContext,
  allowedDomains: string[],
  baseUrl: string,
  emit: EmitFn
): Promise<void> {
  const reportedBlockedUrls = new Set<string>();

  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = request.url();
    if (isAllowedUrl({ url, allowedDomains, baseUrl })) {
      await route.continue();
      return;
    }

    if (!reportedBlockedUrls.has(url)) {
      reportedBlockedUrls.add(url);
      await emit({
        eventType: "network.failed",
        severity: "WARNING",
        payload: blockedRequestPayload({
          url,
          method: request.method(),
          resourceType: request.resourceType()
        })
      });
    }

    await route.abort("blockedbyclient");
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number | null): Promise<T> {
  if (timeoutMs == null || timeoutMs <= 0) return promise;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new ProductWorkflowError(`Agent exceeded timeout of ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function runAction(
  page: Page,
  action: ScriptedAction,
  runDir: string,
  stepIndex: number
): Promise<{ screenshotPath?: string; pageLoadMs?: number }> {
  switch (action.type) {
    case "goto": {
      const start = Date.now();
      await page.goto(action.url, { waitUntil: "domcontentloaded" });
      const pageLoadMs = Date.now() - start;
      const screenshotPath = path.join(runDir, `milestone-goto-${stepIndex + 1}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      return { screenshotPath, pageLoadMs };
    }
    case "click":
      await withFallbackLocator(page, action.selector, (locator) => locator.click());
      return {};
    case "fill":
      await withFallbackLocator(page, action.selector, (locator) => locator.fill(action.value));
      return {};
    case "select":
      await withFallbackLocator(page, action.selector, async (locator) => {
        await locator.selectOption(action.value);
      });
      return {};
    case "wait":
      await page.waitForTimeout(action.ms);
      return {};
    case "expectText": {
      await page.getByText(action.text, { exact: false }).first().waitFor({ state: "visible" });
      const screenshotPath = path.join(runDir, `milestone-assert-${stepIndex + 1}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      return { screenshotPath };
    }
    case "screenshot": {
      const fileName = getScreenshotFileName(action, Date.now());
      const screenshotPath = path.join(runDir, fileName);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      return { screenshotPath };
    }
    default:
      throw new Error("Unsupported action");
  }
}

function getScreenshotFileName(action: Extract<ScriptedAction, { type: "screenshot" }>, fallback: number): string {
  const raw = action.name?.trim() || `step-${fallback}`;
  const safe = raw.replace(/[^a-zA-Z0-9-_]/g, "-");
  return `${safe}.png`;
}

async function withFallbackLocator(
  page: Page,
  rawSelector: string,
  callback: (locator: ReturnType<Page["locator"]>) => Promise<void>
): Promise<void> {
  const selectors = splitSelectorList(rawSelector);
  let lastError: unknown;

  for (const selector of selectors) {
    try {
      await callback(page.locator(selector).first());
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Unable to interact with selector "${rawSelector}"`);
}

export function splitSelectorList(rawSelector: string): string[] {
  const selectors: string[] = [];
  let current = "";
  let bracketDepth = 0;
  let quote: '"' | "'" | null = null;

  for (const character of rawSelector) {
    if (quote) {
      current += character;
      if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      current += character;
      continue;
    }

    if (character === "[") {
      bracketDepth += 1;
      current += character;
      continue;
    }

    if (character === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
      current += character;
      continue;
    }

    if (character === "," && bracketDepth === 0) {
      const selector = current.trim();
      if (selector) selectors.push(selector);
      current = "";
      continue;
    }

    current += character;
  }

  const selector = current.trim();
  if (selector) selectors.push(selector);

  return selectors.length > 0 ? selectors : [rawSelector.trim()].filter(Boolean);
}
