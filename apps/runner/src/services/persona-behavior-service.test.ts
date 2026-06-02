import assert from "node:assert/strict";
import test from "node:test";
import { PersonaBehaviorService } from "./persona-behavior-service.js";

const service = new PersonaBehaviorService();

test("buildProfile creates distinct thresholds for low-tech impatient persona", () => {
  const profile = service.buildProfile({
    name: "LowTech",
    role: "Staff",
    industry: "Healthcare",
    technicalProficiency: 20,
    domainExpertise: 80,
    timePressure: 85,
    patience: 20,
    confidence: 25,
    errorRecovery: 30,
    riskTolerance: 20,
    accessibilityNeeds: [],
    behaviorNotes: ""
  });

  assert.ok(profile.promptInstructions.some((x) => x.toLowerCase().includes("visible labels")));
  assert.ok(profile.thresholds.maxWaitMs <= 4000);
  assert.ok(profile.thresholds.abandonmentThreshold <= 70);
});

test("buildProfile creates exploratory profile for high-tech persona", () => {
  const profile = service.buildProfile({
    name: "Power",
    role: "Admin",
    industry: "SaaS",
    technicalProficiency: 92,
    domainExpertise: 70,
    timePressure: 30,
    patience: 82,
    confidence: 88,
    errorRecovery: 84,
    riskTolerance: 78,
    accessibilityNeeds: [],
    behaviorNotes: ""
  });

  assert.ok(profile.thresholds.maxWaitMs >= 3000);
  assert.ok(profile.thresholds.explorationTendency >= 0.7);
  assert.ok(profile.thresholds.retryTendency >= 0.6);
});

test("estimateFrustrationDelta rises for failures and long waits", () => {
  const profile = service.buildProfile(null);
  const delta = service.estimateFrustrationDelta({
    action: "wait",
    success: false,
    confidence: 0.3,
    durationMs: profile.thresholds.maxWaitMs + 2000,
    thresholds: profile.thresholds
  });

  assert.ok(delta >= 10);
});
