import type { Page } from "playwright";
import { env } from "../lib/config.js";
import type { AgentMemoryService } from "./agent-memory-service.js";

type PersonaTraits = {
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
};

export type PageObservation = {
  currentUrl: string;
  pageTitle: string;
  visibleTextSummary: string;
  buttons: string[];
  links: string[];
  inputs: string[];
  recentActions: Array<{ action: string; target: string; result: string; reason: string }>;
  workflowGoal: string;
  personaTraits: PersonaTraits | null;
};

export class PageObservationService {
  async observe(input: {
    page: Page;
    workflowGoal: string;
    personaTraits: PersonaTraits | null;
    memory: AgentMemoryService;
  }): Promise<PageObservation> {
    const page = input.page;
    const currentUrl = page.url();
    const pageTitle = await page.title();
    const text = await page.locator("body").innerText().catch(() => "");

    const buttons = await this.collectText(page, "button, [role='button']", 15);
    const links = await this.collectText(page, "a[href]", 15);
    const inputs = await this.collectInputHints(page, 20);

    return {
      currentUrl,
      pageTitle,
      visibleTextSummary: summarizeText(text, env.RUNNER_OBS_TEXT_MAX_CHARS),
      buttons,
      links,
      inputs,
      recentActions: input.memory.recentActions().map((item) => ({
        action: item.action,
        target: item.target,
        result: item.result,
        reason: item.reason
      })),
      workflowGoal: input.workflowGoal,
      personaTraits: input.personaTraits
    };
  }

  private async collectText(page: Page, selector: string, max: number): Promise<string[]> {
    const values = await page.locator(selector).allTextContents().catch(() => []);
    return normalizeList(values, max);
  }

  private async collectInputHints(page: Page, max: number): Promise<string[]> {
    const placeholders = await page.locator("input, textarea, select").evaluateAll((nodes) =>
      nodes.map((node) => {
        const anyNode = node as {
          placeholder?: string;
          getAttribute: (name: string) => string | null;
          id?: string;
          tagName?: string;
        };
        return anyNode.placeholder || anyNode.getAttribute("name") || anyNode.getAttribute("aria-label") || anyNode.id || anyNode.tagName || "INPUT";
      })
    ).catch(() => [] as string[]);

    return normalizeList(placeholders, max);
  }
}

function summarizeText(text: string, maxChars: number): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxChars) return compact;
  return `${compact.slice(0, maxChars)}...`;
}

function normalizeList(values: string[], max: number): string[] {
  const normalized = values
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter((value) => value.length > 0)
    .slice(0, max);
  return Array.from(new Set(normalized));
}
