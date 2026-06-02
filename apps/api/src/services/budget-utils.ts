export const DEFAULT_COST_PER_TOKEN_USD = 0.00002;

export function estimateConservativeCostUsd(input: {
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCostUsd?: number | null;
  requestedMaxTokens?: number;
}) {
  if (typeof input.estimatedCostUsd === "number" && Number.isFinite(input.estimatedCostUsd) && input.estimatedCostUsd >= 0) {
    return input.estimatedCostUsd;
  }

  const inputTokens = Math.max(0, input.inputTokens ?? 0);
  const outputTokens = Math.max(0, input.outputTokens ?? 0);
  const measuredTokens = inputTokens + outputTokens;
  const fallbackTokens = Math.max(measuredTokens, input.requestedMaxTokens ?? 0, 1);

  return fallbackTokens * DEFAULT_COST_PER_TOKEN_USD;
}

export function isBudgetExceeded(input: {
  currentRunCostUsd: number;
  currentRunTokens: number;
  currentDailyCostUsd: number;
  maxCostPerRun?: number | null;
  maxTokensPerRun?: number | null;
  maxDailyCost?: number | null;
}) {
  if (input.maxCostPerRun != null && input.currentRunCostUsd > input.maxCostPerRun) {
    return { exceeded: true as const, reason: "maxCostPerRun" as const, limit: input.maxCostPerRun, current: input.currentRunCostUsd };
  }

  if (input.maxTokensPerRun != null && input.currentRunTokens > input.maxTokensPerRun) {
    return { exceeded: true as const, reason: "maxTokensPerRun" as const, limit: input.maxTokensPerRun, current: input.currentRunTokens };
  }

  if (input.maxDailyCost != null && input.currentDailyCostUsd > input.maxDailyCost) {
    return { exceeded: true as const, reason: "maxDailyCost" as const, limit: input.maxDailyCost, current: input.currentDailyCostUsd };
  }

  return { exceeded: false as const };
}
