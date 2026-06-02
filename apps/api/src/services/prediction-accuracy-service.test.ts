import assert from "node:assert/strict";
import test from "node:test";
import { calculateGapPercent, deriveSyntheticPredictionMetrics } from "./prediction-accuracy-service.js";

test("deriveSyntheticPredictionMetrics calculates baseline metrics from run data", () => {
  const metrics = deriveSyntheticPredictionMetrics({
    requestedAgentCount: 4,
    agents: [
      { status: "COMPLETED", startedAt: new Date("2026-06-01T10:00:00.000Z"), finishedAt: new Date("2026-06-01T10:03:00.000Z") },
      { status: "COMPLETED", startedAt: new Date("2026-06-01T10:01:00.000Z"), finishedAt: new Date("2026-06-01T10:05:00.000Z") },
      { status: "FAILED", startedAt: new Date("2026-06-01T10:02:00.000Z"), finishedAt: new Date("2026-06-01T10:04:00.000Z") },
      { status: "RUNNING", startedAt: new Date("2026-06-01T10:02:00.000Z"), finishedAt: null }
    ],
    events: Array.from({ length: 12 }, () => ({ eventType: "action.completed" })),
    findings: [{ severity: "HIGH" }, { severity: "LOW" }]
  });

  assert.deepEqual(metrics, {
    taskSuccessRate: 50,
    completionTimeMs: 210000,
    errorRate: 25,
    apiCallsPerSession: 3,
    supportTicketEstimate: 2
  });
});

test("calculateGapPercent returns null for non-zero synthetic values when actual is zero", () => {
  assert.equal(calculateGapPercent(10, 0), null);
  assert.equal(calculateGapPercent(0, 0), 0);
  assert.equal(calculateGapPercent(110, 100), 10);
});
