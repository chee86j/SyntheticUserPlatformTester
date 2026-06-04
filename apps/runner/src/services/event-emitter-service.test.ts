import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitterService } from "./event-emitter-service.js";

test("EventEmitterService redacts sensitive payload fields before sending", async () => {
  const requests: Array<{ path: string; options?: { body?: unknown } }> = [];
  const service = new EventEmitterService({
    request: async (path: string, options?: { body?: unknown }) => {
      requests.push({ path, options });
      return {} as never;
    }
  } as never);

  await service.emit({
    runId: "run-1",
    agentId: "agent-1",
    eventType: "action.failed",
    payload: {
      password: "Secret123!",
      cookieHeader: "session=abc",
      nested: { authorization: "Bearer abc123" }
    }
  });

  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0]?.options?.body, {
    runId: "run-1",
    agentId: "agent-1",
    personaId: undefined,
    eventType: "action.failed",
    severity: "INFO",
    payload: {
      password: "[redacted]",
      cookieHeader: "[redacted]",
      nested: { authorization: "[redacted]" }
    }
  });
});

test("EventEmitterService requests findings generation through the API boundary", async () => {
  const requests: Array<{ path: string; options?: { method?: string; body?: unknown } }> = [];
  const service = new EventEmitterService({
    request: async (path: string, options?: { method?: string; body?: unknown }) => {
      requests.push({ path, options });
      return { findingsCreated: 4 };
    }
  } as never);

  const result = await service.generateFindings("run-42");

  assert.deepEqual(result, { findingsCreated: 4 });
  assert.deepEqual(requests, [
    {
      path: "/api/runs/run-42/findings/generate",
      options: {
        method: "POST",
        body: {}
      }
    }
  ]);
});
