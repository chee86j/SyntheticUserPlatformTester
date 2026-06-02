export const QUEUE_NAMES = {
  simulationRuns: "simulation-runs",
  agentJobs: "agent-jobs",
  reportJobs: "report-jobs"
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
