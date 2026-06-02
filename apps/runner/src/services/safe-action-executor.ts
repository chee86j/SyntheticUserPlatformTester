import type { Page } from "playwright";
import path from "node:path";
import type { LlmAction } from "./llm-action-parser.js";

export class SafeActionExecutor {
  async execute(input: {
    page: Page;
    action: LlmAction;
    runDir: string;
    stepIndex: number;
  }): Promise<{ success: boolean; terminal: boolean; terminalReason?: string; screenshotPath?: string }> {
    const { page, action } = input;

    if (action.action === "finish") {
      return { success: true, terminal: true, terminalReason: "finish" };
    }

    if (action.action === "fail") {
      return { success: false, terminal: true, terminalReason: action.reason };
    }

    switch (action.action) {
      case "click":
        await this.clickByText(page, action.target);
        return { success: true, terminal: false };
      case "type":
        await this.typeInto(page, action.target);
        return { success: true, terminal: false };
      case "select":
        await this.selectOption(page, action.target);
        return { success: true, terminal: false };
      case "scroll":
        await page.mouse.wheel(0, 700);
        return { success: true, terminal: false };
      case "wait":
        await page.waitForTimeout(this.parseDurationMs(action.target));
        return { success: true, terminal: false };
      case "goBack":
        await page.goBack({ waitUntil: "domcontentloaded" });
        return { success: true, terminal: false };
      default:
        throw new Error("Unsupported safe action");
    }
  }

  async captureFailureScreenshot(page: Page, runDir: string, stepIndex: number): Promise<string> {
    const filePath = path.join(runDir, `llm-failed-step-${stepIndex + 1}.png`);
    await page.screenshot({ path: filePath, fullPage: true });
    return filePath;
  }

  private async clickByText(page: Page, target: string): Promise<void> {
    const button = page.getByRole("button", { name: target, exact: false }).first();
    if (await button.count()) {
      await button.click();
      return;
    }

    const link = page.getByRole("link", { name: target, exact: false }).first();
    if (await link.count()) {
      await link.click();
      return;
    }

    const textNode = page.getByText(target, { exact: false }).first();
    await textNode.click();
  }

  private async typeInto(page: Page, target: string): Promise<void> {
    const parsed = splitTarget(target);
    const field = parsed.field;
    const value = parsed.value;

    const byLabel = page.getByLabel(field, { exact: false }).first();
    if (await byLabel.count()) {
      await byLabel.fill(value);
      return;
    }

    const byPlaceholder = page.getByPlaceholder(field, { exact: false }).first();
    if (await byPlaceholder.count()) {
      await byPlaceholder.fill(value);
      return;
    }

    const byName = page.locator(`input[name='${cssEscape(field)}'], textarea[name='${cssEscape(field)}']`).first();
    if (await byName.count()) {
      await byName.fill(value);
      return;
    }

    throw new Error(`No input found for target: ${field}`);
  }

  private async selectOption(page: Page, target: string): Promise<void> {
    const parsed = splitTarget(target);
    const field = parsed.field;
    const value = parsed.value;

    const selectByLabel = page.getByLabel(field, { exact: false }).first();
    if (await selectByLabel.count()) {
      await selectByLabel.selectOption({ label: value });
      return;
    }

    const selectByName = page.locator(`select[name='${cssEscape(field)}']`).first();
    if (await selectByName.count()) {
      await selectByName.selectOption({ label: value });
      return;
    }

    throw new Error(`No select found for target: ${field}`);
  }

  private parseDurationMs(target: string): number {
    const maybeNumber = Number(target);
    if (Number.isFinite(maybeNumber) && maybeNumber >= 0) {
      return Math.min(10000, maybeNumber);
    }
    return 1000;
  }
}

function splitTarget(target: string): { field: string; value: string } {
  const separators = ["=>", ":", "="];
  for (const separator of separators) {
    const idx = target.indexOf(separator);
    if (idx > 0) {
      const field = target.slice(0, idx).trim();
      const value = target.slice(idx + separator.length).trim();
      if (field && value) {
        return { field, value };
      }
    }
  }

  return { field: target.trim(), value: "" };
}

function cssEscape(value: string): string {
  return value.replace(/['\\]/g, "\\$&");
}
