import { env } from "./config.js";
import { scriptedWorkflowSchema, type ScriptedAction } from "./actions.js";

type WorkflowLike = {
  startingPath: string;
  successCriteria: unknown;
};

type AccountLike = {
  username: string;
  password: string;
};

function getExpectedText(successCriteria: unknown): string | null {
  if (!Array.isArray(successCriteria)) return null;
  const criterion = successCriteria.find(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      (item as { type?: string }).type === "PAGE_CONTAINS_TEXT" &&
      typeof (item as { value?: unknown }).value === "string"
  ) as { value?: string } | undefined;

  return criterion?.value ?? null;
}

export function buildScript(
  workflow: WorkflowLike,
  environmentBaseUrl: string,
  account: AccountLike
): ScriptedAction[] {
  if (env.RUNNER_SCRIPT_JSON) {
    const parsed = JSON.parse(env.RUNNER_SCRIPT_JSON);
    return scriptedWorkflowSchema.parse(parsed);
  }

  const startUrl = new URL(workflow.startingPath || "/", environmentBaseUrl).toString();
  const expectedText = getExpectedText(workflow.successCriteria);

  const actions: ScriptedAction[] = [
    { type: "goto", url: startUrl },
    { type: "fill", selector: env.RUNNER_LOGIN_USERNAME_SELECTOR, value: account.username },
    { type: "fill", selector: env.RUNNER_LOGIN_PASSWORD_SELECTOR, value: account.password },
    { type: "click", selector: env.RUNNER_LOGIN_SUBMIT_SELECTOR },
    { type: "wait", ms: 1200 }
  ];

  if (expectedText) {
    actions.push({ type: "expectText", text: expectedText });
  }

  actions.push({ type: "screenshot", name: "post-login" });

  return scriptedWorkflowSchema.parse(actions);
}
