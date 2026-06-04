import type { EventSeverity } from "@prisma/client";
import { redactEventPayload } from "@synthetic/shared";
import { RunnerApiClient } from "../lib/api-client.js";

type EmittableEventType =
  | "run.started"
  | "run.completed"
  | "run.failed"
  | "run.cancelled"
  | "agent.started"
  | "agent.completed"
  | "agent.failed"
  | "agent.logged_in"
  | "action.started"
  | "action.completed"
  | "action.failed"
  | "console.error"
  | "network.failed"
  | "screenshot.captured"
  | "artifact.created"
  | "workflow.completed"
  | "workflow.failed"
  | "budget.exceeded";

export class EventEmitterService {
  constructor(private readonly api: RunnerApiClient) {}

  async generateFindings(runId: string): Promise<{ findingsCreated: number }> {
    return this.api.request(`/api/runs/${runId}/findings/generate`, {
      method: "POST",
      body: {}
    });
  }

  async emit(input: {
    runId: string;
    agentId?: string;
    personaId?: string;
    eventType: EmittableEventType;
    severity?: EventSeverity;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.api.request("/api/events", {
      method: "POST",
      body: {
        runId: input.runId,
        agentId: input.agentId,
        personaId: input.personaId,
        eventType: input.eventType,
        severity: input.severity ?? "INFO",
        payload: redactEventPayload(input.payload)
      }
    });
  }
}
