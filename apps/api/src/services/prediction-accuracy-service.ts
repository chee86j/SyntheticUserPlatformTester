import type { FindingSeverity } from "@prisma/client";

type AgentLike = {
  status: "IDLE" | "RUNNING" | "COMPLETED" | "FAILED";
  startedAt: Date | null;
  finishedAt: Date | null;
};

type EventLike = {
  eventType: string;
};

type FindingLike = {
  severity: FindingSeverity | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
};

export type SyntheticPredictionMetrics = {
  taskSuccessRate: number;
  completionTimeMs: number;
  errorRate: number;
  apiCallsPerSession: number;
  supportTicketEstimate: number;
};

export function deriveSyntheticPredictionMetrics(input: {
  requestedAgentCount: number;
  agents: AgentLike[];
  events: EventLike[];
  findings: FindingLike[];
}): SyntheticPredictionMetrics {
  const totalAgents = Math.max(input.requestedAgentCount, input.agents.length, 1);
  const completedAgents = input.agents.filter((agent) => agent.status === "COMPLETED");
  const failedAgents = input.agents.filter((agent) => agent.status === "FAILED").length;
  const actionCompletedCount = input.events.filter((event) => event.eventType === "action.completed").length;
  const highSeverityFindings = input.findings.filter(
    (finding) => finding.severity === "HIGH" || finding.severity === "CRITICAL"
  ).length;

  const completionDurations = completedAgents
    .map((agent) =>
      agent.startedAt && agent.finishedAt ? agent.finishedAt.getTime() - agent.startedAt.getTime() : null
    )
    .filter((value): value is number => typeof value === "number" && value >= 0);

  return {
    taskSuccessRate: round((completedAgents.length / totalAgents) * 100),
    completionTimeMs: Math.round(average(completionDurations)),
    errorRate: round((failedAgents / totalAgents) * 100),
    apiCallsPerSession: round(actionCompletedCount / totalAgents),
    supportTicketEstimate: Math.max(0, failedAgents + highSeverityFindings)
  };
}

export function calculateGapPercent(syntheticValue: number, actualValue: number): number | null {
  if (actualValue === 0) {
    return syntheticValue === 0 ? 0 : null;
  }

  return round(((syntheticValue - actualValue) / actualValue) * 100);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
