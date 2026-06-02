import type { PageObservation } from "./page-observation-service.js";

export class AgentPromptBuilder {
  buildPrompt(input: {
    observation: PageObservation;
    successCriteria: unknown;
    maxActionsRemaining: number;
  }): string {
    return [
      "You are a synthetic user agent. Choose exactly one next UI action.",
      "You must return strict JSON only, with keys: action, target, reason, confidence, frustrationDelta.",
      "Allowed actions: click, type, select, scroll, wait, goBack, finish, fail.",
      "Never return markdown or extra explanation.",
      "",
      "Workflow goal:",
      input.observation.workflowGoal,
      "",
      "Success criteria:",
      JSON.stringify(input.successCriteria),
      "",
      "Current page observation:",
      JSON.stringify({
        currentUrl: input.observation.currentUrl,
        pageTitle: input.observation.pageTitle,
        visibleTextSummary: input.observation.visibleTextSummary,
        buttons: input.observation.buttons,
        links: input.observation.links,
        inputs: input.observation.inputs,
        recentActions: input.observation.recentActions,
        personaTraits: input.observation.personaTraits
      }),
      "",
      `Max actions remaining: ${input.maxActionsRemaining}`,
      "If the goal is complete, return finish.",
      "If blocked and cannot proceed safely, return fail."
    ].join("\n");
  }
}
