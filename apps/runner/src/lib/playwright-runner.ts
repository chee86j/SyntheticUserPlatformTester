import { chromium, type Page } from "playwright";
import { env } from "./config.js";
import type { ScriptedAction } from "./actions.js";

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

export async function executeScriptedWorkflow(input: {
  actions: ScriptedAction[];
  screenshotsDir: string;
  emit: EmitFn;
}): Promise<void> {
  const browser = await chromium.launch({ headless: env.RUNNER_HEADLESS, slowMo: env.RUNNER_SLOW_MO_MS });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(env.RUNNER_NAV_TIMEOUT_MS);

    page.on("console", async (message) => {
      if (message.type() === "error") {
        await input.emit({
          eventType: "console.error",
          severity: "ERROR",
          payload: { message: message.text() }
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

    for (let index = 0; index < input.actions.length; index += 1) {
      const action = input.actions[index];
      const startedAt = Date.now();
      await input.emit({
        eventType: "action.started",
        payload: { action: action.type, index }
      });

      try {
        await runAction(page, action, input.screenshotsDir);
        const durationMs = Date.now() - startedAt;
        await input.emit({
          eventType: "action.completed",
          payload: { action: action.type, index, durationMs }
        });

        if (action.type === "screenshot") {
          const fileName = getScreenshotFileName(action, index);
          await input.emit({
            eventType: "screenshot.captured",
            payload: { uri: fileName }
          });
          await input.emit({
            eventType: "artifact.created",
            payload: { type: "SCREENSHOT", uri: fileName }
          });
        }
      } catch (error) {
        const failureShot = `${input.screenshotsDir}/failed-step-${index + 1}.png`;
        await page.screenshot({ path: failureShot, fullPage: true });
        await input.emit({
          eventType: "screenshot.captured",
          severity: "WARNING",
          payload: { uri: failureShot }
        });
        await input.emit({
          eventType: "action.failed",
          severity: "ERROR",
          payload: {
            action: action.type,
            index,
            error: error instanceof Error ? error.message : "Unknown action error"
          }
        });
        throw error;
      }
    }

    await context.close();
  } finally {
    await browser.close();
  }
}

async function runAction(page: Page, action: ScriptedAction, screenshotsDir: string): Promise<void> {
  switch (action.type) {
    case "goto":
      await page.goto(action.url, { waitUntil: "domcontentloaded" });
      return;
    case "click":
      await page.locator(action.selector).first().click();
      return;
    case "fill":
      await page.locator(action.selector).first().fill(action.value);
      return;
    case "select":
      await page.locator(action.selector).first().selectOption(action.value);
      return;
    case "wait":
      await page.waitForTimeout(action.ms);
      return;
    case "expectText":
      await page.getByText(action.text, { exact: false }).first().waitFor({ state: "visible" });
      return;
    case "screenshot": {
      const fileName = getScreenshotFileName(action, Date.now());
      await page.screenshot({ path: `${screenshotsDir}/${fileName}`, fullPage: true });
      return;
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
