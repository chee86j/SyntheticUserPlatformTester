import assert from "node:assert/strict";
import test from "node:test";
import { EventSeverity } from "@prisma/client";
import { toSimulationEventCreateData, toSimulationEventRunQuery } from "./index.js";

test("toSimulationEventCreateData maps required fields for event creation", () => {
  const timestamp = new Date("2026-05-31T12:00:00.000Z");
  const data = toSimulationEventCreateData({
    organizationId: "org-1",
    runId: "run-1",
    agentId: "agent-1",
    personaId: "persona-1",
    traceId: "trace-123",
    eventType: "action.completed",
    severity: EventSeverity.WARNING,
    payload: { action: "submit_form" },
    timestamp
  });

  assert.equal(data.organizationId, "org-1");
  assert.equal(data.runId, "run-1");
  assert.equal(data.agentId, "agent-1");
  assert.equal(data.personaId, "persona-1");
  assert.equal(data.traceId, "trace-123");
  assert.equal(data.eventType, "action.completed");
  assert.equal(data.severity, EventSeverity.WARNING);
  assert.deepEqual(data.payload, { action: "submit_form" });
  assert.equal(data.timestamp.toISOString(), timestamp.toISOString());
});

test("toSimulationEventCreateData defaults severity to INFO", () => {
  const data = toSimulationEventCreateData({
    organizationId: "org-1",
    runId: "run-1",
    eventType: "run.started",
    payload: {}
  });

  assert.equal(data.severity, EventSeverity.INFO);
});

test("toSimulationEventRunQuery scopes query by run and organization", () => {
  const query = toSimulationEventRunQuery("run-123", "org-123");
  assert.deepEqual(query, {
    where: { runId: "run-123", organizationId: "org-123" },
    orderBy: { timestamp: "asc" }
  });
});
