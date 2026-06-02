import test from "node:test";
import assert from "node:assert/strict";
import { estimateConservativeCostUsd, isBudgetExceeded } from "./budget-utils.js";

test("estimateConservativeCostUsd uses provider estimate when available", () => {
  const value = estimateConservativeCostUsd({ estimatedCostUsd: 0.1234, inputTokens: 10, outputTokens: 20 });
  assert.equal(value, 0.1234);
});

test("estimateConservativeCostUsd falls back to measured tokens", () => {
  const value = estimateConservativeCostUsd({ inputTokens: 100, outputTokens: 50, requestedMaxTokens: 10 });
  assert.equal(value, 150 * 0.00002);
});

test("estimateConservativeCostUsd fails safe with requested max tokens", () => {
  const value = estimateConservativeCostUsd({ requestedMaxTokens: 500 });
  assert.equal(value, 500 * 0.00002);
});

test("isBudgetExceeded catches run cost limit", () => {
  const result = isBudgetExceeded({
    currentRunCostUsd: 5.1,
    currentRunTokens: 100,
    currentDailyCostUsd: 7,
    maxCostPerRun: 5,
    maxTokensPerRun: 1000,
    maxDailyCost: 100
  });

  assert.equal(result.exceeded, true);
  if (result.exceeded) assert.equal(result.reason, "maxCostPerRun");
});

test("isBudgetExceeded catches token limit", () => {
  const result = isBudgetExceeded({
    currentRunCostUsd: 1,
    currentRunTokens: 1200,
    currentDailyCostUsd: 2,
    maxCostPerRun: 5,
    maxTokensPerRun: 1000,
    maxDailyCost: 100
  });

  assert.equal(result.exceeded, true);
  if (result.exceeded) assert.equal(result.reason, "maxTokensPerRun");
});

test("isBudgetExceeded catches daily limit", () => {
  const result = isBudgetExceeded({
    currentRunCostUsd: 1,
    currentRunTokens: 100,
    currentDailyCostUsd: 60,
    maxCostPerRun: 5,
    maxTokensPerRun: 1000,
    maxDailyCost: 50
  });

  assert.equal(result.exceeded, true);
  if (result.exceeded) assert.equal(result.reason, "maxDailyCost");
});
