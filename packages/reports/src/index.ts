type ReportRun = {
  id: string;
  status: string;
  createdAt: Date | string;
  startedAt: Date | string | null;
  finishedAt: Date | string | null;
  requestedAgentCount: number;
  maxRunDurationSeconds: number;
  project: { name: string };
  environment: { name: string; baseUrl: string; type: string };
  workflow: {
    name: string;
    goal: string;
    startingPath: string;
    workflowType: string;
    maxSteps: number;
    maxDurationSeconds: number;
    successCriteria: unknown;
  };
  budgetPolicy?: {
    name: string;
    maxCostPerRun: number | null;
    maxTokensPerRun: number | null;
    maxActionsPerAgent: number | null;
    maxDurationPerRunSeconds: number | null;
  } | null;
};

type ReportPersona = {
  id: string;
  name: string;
  role: string;
  industry: string;
  technicalProficiency: number;
  patience: number;
  timePressure: number;
  accessibilityNeeds: string[];
};

type ReportAgent = {
  id: string;
  personaId: string | null;
  testAccountId: string | null;
  status: string;
  startedAt: Date | string | null;
  finishedAt: Date | string | null;
};

type ReportEvent = {
  id: string;
  agentId: string | null;
  personaId: string | null;
  traceId?: string | null;
  eventType: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  payload: Record<string, unknown>;
  timestamp: Date | string;
};

type ReportArtifact = {
  id: string;
  type: string;
  uri: string;
  createdAt: Date | string;
};

type ReportFinding = {
  type: string;
  title: string;
  summary: string;
  severity: string;
  recommendation: string;
};

type ReportUsage = {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  agentId: string | null;
};

type BudgetSummary = {
  totals: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
  remaining: {
    cost: number | null;
    tokens: number | null;
  };
  projected: {
    next1000TokensCost: number | null;
  };
};

export type GenerateRunReportInput = {
  generatedAt?: Date;
  run: ReportRun;
  personas: ReportPersona[];
  agents: ReportAgent[];
  events: ReportEvent[];
  artifacts: ReportArtifact[];
  findings?: ReportFinding[];
  llmUsage?: ReportUsage[];
  budgetSummary?: BudgetSummary | null;
};

type DerivedFinding = {
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  summary: string;
  recommendation: string;
};

export function generateRunReportMarkdown(input: GenerateRunReportInput): string {
  const generatedAt = input.generatedAt ?? new Date();
  const sortedEvents = [...input.events].sort((left, right) => toDate(left.timestamp).getTime() - toDate(right.timestamp).getTime());
  const sortedArtifacts = [...input.artifacts].sort(
    (left, right) => toDate(right.createdAt).getTime() - toDate(left.createdAt).getTime()
  );
  const eventCounts = countBy(sortedEvents, (event) => event.eventType);
  const technicalErrors = collectTechnicalErrors(sortedEvents);
  const topFindings = deriveFindings(input.findings ?? [], sortedEvents, input.budgetSummary);
  const personaRows = buildPersonaRows(input.personas, input.agents, sortedEvents);
  const llmRows = buildLlmRows(input.llmUsage ?? []);
  const keyMetrics = buildKeyMetrics(input, sortedEvents, technicalErrors.length);
  const executiveSummary = buildExecutiveSummary(input, keyMetrics, topFindings);
  const recommendations = topFindings.map((finding) => finding.recommendation).filter(uniqueText).slice(0, 5);

  const sections = [
    '# Post-Run Report',
    '',
    `- Generated: ${formatDate(generatedAt)}`,
    `- Run ID: ${input.run.id}`,
    `- Status: ${formatLabel(input.run.status)}`,
    '',
    '## 1. Executive Summary',
    '',
    ...executiveSummary.map((line) => `- ${line}`),
    '',
    '## 2. Run Configuration',
    '',
    markdownTable(
      ['Field', 'Value'],
      [
        ['Project', input.run.project.name],
        ['Environment', `${input.run.environment.name} (${input.run.environment.type})`],
        ['Base URL', safePathOrUrl(input.run.environment.baseUrl)],
        ['Workflow', input.run.workflow.name],
        ['Workflow Goal', safeText(input.run.workflow.goal)],
        ['Workflow Type', formatLabel(input.run.workflow.workflowType)],
        ['Starting Path', safeText(input.run.workflow.startingPath)],
        ['Requested Agents', String(input.run.requestedAgentCount)],
        ['Max Run Duration', `${input.run.maxRunDurationSeconds}s`],
        ['Workflow Max Steps', String(input.run.workflow.maxSteps)],
        ['Workflow Max Duration', `${input.run.workflow.maxDurationSeconds}s`],
        ['Budget Policy', input.run.budgetPolicy?.name ?? 'None'],
        ['Budget Caps', formatBudgetCaps(input.run.budgetPolicy ?? null)]
      ]
    ),
    '',
    '## 3. Persona Breakdown',
    '',
    personaRows.length === 0
      ? '_No persona assignments recorded._'
      : markdownTable(
          ['Persona', 'Assigned Agents', 'Completed', 'Failed', 'Avg Frustration', 'Profile Notes'],
          personaRows.map((row) => [
            row.name,
            String(row.assignedAgents),
            String(row.completedAgents),
            String(row.failedAgents),
            row.avgFrustration == null ? 'n/a' : row.avgFrustration.toFixed(1),
            safeText(row.profileNote)
          ])
        ),
    '',
    '## 4. Workflow Results',
    '',
    ...[
      `- Final run status: ${formatLabel(input.run.status)}.`,
      `- Agent completion: ${keyMetrics.completedAgents}/${input.agents.length || input.run.requestedAgentCount} completed, ${keyMetrics.failedAgents} failed.`,
      `- Workflow outcomes: ${keyMetrics.completedWorkflows} completed workflow events, ${keyMetrics.failedWorkflows} failed workflow events.`,
      `- Run duration: ${keyMetrics.runDurationLabel}.`,
      `- Success criteria: ${summarizeCriteria(input.run.workflow.successCriteria)}`
    ],
    '',
    '## 5. Key Metrics',
    '',
    markdownTable(
      ['Metric', 'Value'],
      [
        ['Total Events', String(sortedEvents.length)],
        ['Total Actions', String(keyMetrics.totalActions)],
        ['Completed Agents', String(keyMetrics.completedAgents)],
        ['Failed Agents', String(keyMetrics.failedAgents)],
        ['Completed Workflows', String(keyMetrics.completedWorkflows)],
        ['Failed Workflows', String(keyMetrics.failedWorkflows)],
        ['Technical Errors', String(technicalErrors.length)],
        ['Artifacts Captured', String(sortedArtifacts.length)],
        ['Screenshots Captured', String(sortedArtifacts.filter((artifact) => artifact.type === 'SCREENSHOT').length)],
        ['Total LLM Tokens', String(input.budgetSummary?.totals.totalTokens ?? sum(input.llmUsage ?? [], (usage) => usage.totalTokens))],
        ['Estimated LLM Cost', formatUsd(input.budgetSummary?.totals.estimatedCostUsd ?? sum(input.llmUsage ?? [], (usage) => usage.estimatedCostUsd))]
      ]
    ),
    '',
    '## 6. Top Findings',
    '',
    ...(topFindings.length === 0
      ? ['- No material findings were generated for this run.']
      : topFindings.slice(0, 5).map(
          (finding, index) =>
            `- ${index + 1}. **${finding.severity}** — ${safeText(finding.title)}. ${safeText(finding.summary)}`
        )),
    '',
    '## 7. Technical Errors',
    '',
    ...(technicalErrors.length === 0
      ? ['- No technical errors were recorded.']
      : technicalErrors.slice(0, 10).map(
          (error) =>
            `- ${formatDate(error.timestamp)} · ${error.eventType} · ${error.agentLabel} · ${safeText(error.message)}`
        )),
    '',
    '## 8. Screenshots and Artifacts',
    '',
    ...(sortedArtifacts.length === 0
      ? ['- No artifacts were stored.']
      : sortedArtifacts.slice(0, 12).map(
          (artifact) =>
            `- ${formatLabel(artifact.type)} · ${formatDate(artifact.createdAt)} · ${safePathOrUrl(artifact.uri)}`
        )),
    ...(sortedArtifacts.length > 12 ? [`- Additional artifacts not listed: ${sortedArtifacts.length - 12}`] : []),
    '',
    '## 9. Budget and LLM Usage',
    '',
    markdownTable(
      ['Category', 'Value'],
      [
        ['Input Tokens', String(input.budgetSummary?.totals.inputTokens ?? sum(input.llmUsage ?? [], (usage) => usage.inputTokens))],
        ['Output Tokens', String(input.budgetSummary?.totals.outputTokens ?? sum(input.llmUsage ?? [], (usage) => usage.outputTokens))],
        ['Total Tokens', String(input.budgetSummary?.totals.totalTokens ?? sum(input.llmUsage ?? [], (usage) => usage.totalTokens))],
        ['Estimated Cost', formatUsd(input.budgetSummary?.totals.estimatedCostUsd ?? sum(input.llmUsage ?? [], (usage) => usage.estimatedCostUsd))],
        ['Remaining Cost Budget', formatNullableUsd(input.budgetSummary?.remaining.cost ?? null)],
        ['Remaining Token Budget', formatNullableNumber(input.budgetSummary?.remaining.tokens ?? null)],
        ['Projected Next 1k Tokens Cost', formatNullableUsd(input.budgetSummary?.projected.next1000TokensCost ?? null)]
      ]
    ),
    '',
    ...(llmRows.length === 0
      ? ['_No LLM usage records were captured for this run._']
      : [
          markdownTable(
            ['Provider', 'Model', 'Calls', 'Tokens', 'Estimated Cost'],
            llmRows.map((row) => [
              row.provider,
              row.model,
              String(row.calls),
              String(row.totalTokens),
              formatUsd(row.estimatedCostUsd)
            ])
          )
        ]),
    '',
    '## 10. Recommendations',
    '',
    ...(recommendations.length === 0
      ? ['- No additional recommendations at this time.']
      : recommendations.map((recommendation) => `- ${safeText(recommendation)}`)),
    '',
    '## 11. Appendix: Event Summary',
    '',
    markdownTable(
      ['Event Type', 'Count'],
      Object.entries(eventCounts)
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([eventType, count]) => [eventType, String(count)])
    )
  ];

  return sections.join('\n').trimEnd() + '\n';
}

function buildExecutiveSummary(
  input: GenerateRunReportInput,
  metrics: ReturnType<typeof buildKeyMetrics>,
  findings: DerivedFinding[]
): string[] {
  const summary: string[] = [];
  summary.push(
    `${input.run.project.name} ran ${input.run.workflow.name} against ${input.run.environment.name} with ${input.run.requestedAgentCount} requested agents and finished with status ${formatLabel(input.run.status)}.`
  );
  summary.push(
    `${metrics.completedAgents} agents completed successfully, ${metrics.failedAgents} failed, and ${metrics.totalActions} actions were recorded across ${metrics.totalEvents} events.`
  );

  if (findings.length > 0) {
    summary.push(`The highest-priority issue was ${safeText(findings[0].title).toLowerCase()}.`);
  }

  if (metrics.estimatedCostUsd > 0 || metrics.totalTokens > 0) {
    summary.push(
      `Estimated LLM usage totaled ${metrics.totalTokens} tokens at ${formatUsd(metrics.estimatedCostUsd)}.`
    );
  }

  return summary.slice(0, 4);
}

function buildKeyMetrics(
  input: GenerateRunReportInput,
  events: ReportEvent[],
  technicalErrorCount: number
) {
  const totalActions = events.filter((event) => event.eventType.startsWith('action.')).length;
  const completedWorkflows = events.filter((event) => event.eventType === 'workflow.completed').length;
  const failedWorkflows = events.filter((event) => event.eventType === 'workflow.failed').length;
  const completedAgents = input.agents.filter((agent) => agent.status === 'COMPLETED').length;
  const failedAgents = input.agents.filter((agent) => agent.status === 'FAILED').length;
  const totalTokens = input.budgetSummary?.totals.totalTokens ?? sum(input.llmUsage ?? [], (usage) => usage.totalTokens);
  const estimatedCostUsd =
    input.budgetSummary?.totals.estimatedCostUsd ?? sum(input.llmUsage ?? [], (usage) => usage.estimatedCostUsd);
  const runDurationMs = deriveRunDurationMs(input.run, events);

  return {
    totalEvents: events.length,
    totalActions,
    completedWorkflows,
    failedWorkflows,
    completedAgents,
    failedAgents,
    totalTokens,
    estimatedCostUsd,
    technicalErrorCount,
    runDurationLabel: runDurationMs == null ? 'n/a' : formatDuration(runDurationMs)
  };
}

function buildPersonaRows(personas: ReportPersona[], agents: ReportAgent[], events: ReportEvent[]) {
  const frustrationByPersona = new Map<string, number[]>();
  for (const event of events) {
    if (!event.personaId) continue;
    const frustration = asNumber((event.payload as Record<string, unknown>).frustrationScore);
    if (frustration == null) continue;
    const current = frustrationByPersona.get(event.personaId) ?? [];
    current.push(frustration);
    frustrationByPersona.set(event.personaId, current);
  }

  return personas.map((persona) => {
    const assignedAgents = agents.filter((agent) => agent.personaId === persona.id);
    const frustrations = frustrationByPersona.get(persona.id) ?? [];

    return {
      name: `${persona.name} (${persona.role})`,
      assignedAgents: assignedAgents.length,
      completedAgents: assignedAgents.filter((agent) => agent.status === 'COMPLETED').length,
      failedAgents: assignedAgents.filter((agent) => agent.status === 'FAILED').length,
      avgFrustration:
        frustrations.length === 0
          ? null
          : frustrations.reduce((total, value) => total + value, 0) / frustrations.length,
      profileNote: describePersona(persona)
    };
  });
}

function buildLlmRows(usages: ReportUsage[]) {
  const grouped = new Map<string, { provider: string; model: string; calls: number; totalTokens: number; estimatedCostUsd: number }>();
  for (const usage of usages) {
    const key = `${usage.provider}:${usage.model}`;
    const current = grouped.get(key) ?? {
      provider: usage.provider,
      model: usage.model,
      calls: 0,
      totalTokens: 0,
      estimatedCostUsd: 0
    };
    current.calls += 1;
    current.totalTokens += usage.totalTokens;
    current.estimatedCostUsd += usage.estimatedCostUsd;
    grouped.set(key, current);
  }
  return [...grouped.values()].sort((left, right) => right.estimatedCostUsd - left.estimatedCostUsd);
}

function deriveFindings(findings: ReportFinding[], events: ReportEvent[], budgetSummary?: BudgetSummary | null): DerivedFinding[] {
  const derivedFromDb = findings.map((finding) => ({
    title: finding.title,
    severity: normalizeSeverity(finding.severity),
    summary: finding.summary,
    recommendation: finding.recommendation
  }));

  if (derivedFromDb.length > 0) {
    return derivedFromDb.sort(compareFindings);
  }

  const generated: DerivedFinding[] = [];
  const workflowFailures = events.filter((event) => event.eventType === 'workflow.failed').length;
  if (workflowFailures > 0) {
    generated.push({
      title: 'Workflow reliability breakdown',
      severity: workflowFailures >= 3 ? 'High' : 'Medium',
      summary: `${workflowFailures} workflow failure events were recorded during the run.`,
      recommendation: 'Review the failing workflow steps and improve recovery cues on the blocked path.'
    });
  }

  const actionFailures = events.filter((event) => event.eventType === 'action.failed').length;
  if (actionFailures > 0) {
    generated.push({
      title: 'Action execution failures',
      severity: actionFailures >= 6 ? 'High' : 'Medium',
      summary: `${actionFailures} action failures suggest usability or validation breakdowns on key steps.`,
      recommendation: 'Tighten interaction validation, reduce ambiguity, and add clearer inline guidance.'
    });
  }

  const consoleErrors = events.filter((event) => event.eventType === 'console.error').length;
  if (consoleErrors > 0) {
    generated.push({
      title: 'Runtime defects visible in console',
      severity: consoleErrors >= 5 ? 'High' : 'Medium',
      summary: `${consoleErrors} console error events indicate front-end runtime defects during the run.`,
      recommendation: 'Triage the highest-frequency console errors and fix them in the primary workflow.'
    });
  }

  const networkFailures = events.filter((event) => event.eventType === 'network.failed').length;
  if (networkFailures > 0) {
    generated.push({
      title: 'Network instability affected completion',
      severity: networkFailures >= 4 ? 'High' : 'Medium',
      summary: `${networkFailures} network failures were recorded during task execution.`,
      recommendation: 'Improve API resiliency and add clearer retry, timeout, and degraded-state handling.'
    });
  }

  const budgetExceeded = events.some((event) => event.eventType === 'budget.exceeded');
  if (budgetExceeded) {
    generated.push({
      title: 'Budget threshold was exceeded',
      severity: 'High',
      summary: 'Run activity exceeded at least one configured LLM or execution budget threshold.',
      recommendation: 'Reduce prompt volume, lower retry churn, or raise the budget only after validating value.'
    });
  }

  if ((budgetSummary?.totals.totalTokens ?? 0) > 0 && generated.length === 0) {
    generated.push({
      title: 'Run completed without material issues',
      severity: 'Low',
      summary: 'The run completed with recorded usage but without standout technical or workflow failures.',
      recommendation: 'Use the artifact set and event appendix to spot lower-priority optimization opportunities.'
    });
  }

  return generated.sort(compareFindings);
}

function collectTechnicalErrors(events: ReportEvent[]) {
  return events
    .filter(
      (event) =>
        event.severity === 'ERROR' ||
        event.severity === 'CRITICAL' ||
        event.eventType === 'console.error' ||
        event.eventType === 'network.failed' ||
        event.eventType.endsWith('.failed')
    )
    .map((event) => ({
      timestamp: event.timestamp,
      eventType: event.eventType,
      agentLabel: event.agentId ? `agent ${event.agentId}` : 'run',
      message: extractErrorMessage(event)
    }));
}

function extractErrorMessage(event: ReportEvent): string {
  const payload = event.payload ?? {};
  const message =
    asString(payload.reason) ??
    asString(payload.error) ??
    asString(payload.message) ??
    asString(payload.url) ??
    JSON.stringify(redactObject(payload));
  return safeText(message, 180);
}

function summarizeCriteria(criteria: unknown): string {
  if (!Array.isArray(criteria) || criteria.length === 0) {
    return 'No explicit success criteria recorded.';
  }

  const summary = criteria
    .slice(0, 3)
    .map((item) => {
      if (!item || typeof item !== 'object') return 'custom criterion';
      const candidate = item as Record<string, unknown>;
      return `${safeText(asString(candidate.type) ?? 'criterion')}=${safeText(asString(candidate.value) ?? 'n/a')}`;
    })
    .join('; ');

  return criteria.length > 3 ? `${summary}; +${criteria.length - 3} more` : summary;
}

function describePersona(persona: ReportPersona): string {
  const technical = persona.technicalProficiency <= 35 ? 'low technical confidence' : persona.technicalProficiency >= 70 ? 'high technical confidence' : 'moderate technical confidence';
  const patience = persona.patience <= 35 ? 'low patience' : persona.patience >= 70 ? 'high patience' : 'moderate patience';
  const pressure = persona.timePressure >= 70 ? 'high time pressure' : persona.timePressure <= 35 ? 'low time pressure' : 'moderate time pressure';
  const accessibility = persona.accessibilityNeeds.length > 0 ? `needs: ${persona.accessibilityNeeds.join(', ')}` : 'no declared accessibility needs';
  return `${technical}, ${patience}, ${pressure}; ${accessibility}`;
}

function formatBudgetCaps(
  budgetPolicy: GenerateRunReportInput['run']['budgetPolicy']
): string {
  if (!budgetPolicy) return 'Unbounded';

  const caps = [
    budgetPolicy.maxCostPerRun == null ? null : `cost ${formatUsd(budgetPolicy.maxCostPerRun)}`,
    budgetPolicy.maxTokensPerRun == null ? null : `tokens ${budgetPolicy.maxTokensPerRun}`,
    budgetPolicy.maxActionsPerAgent == null ? null : `actions/agent ${budgetPolicy.maxActionsPerAgent}`,
    budgetPolicy.maxDurationPerRunSeconds == null ? null : `duration ${budgetPolicy.maxDurationPerRunSeconds}s`
  ].filter((value): value is string => Boolean(value));

  return caps.length === 0 ? 'Unbounded' : caps.join(', ');
}

function deriveRunDurationMs(run: ReportRun, events: ReportEvent[]): number | null {
  if (run.startedAt && run.finishedAt) {
    return toDate(run.finishedAt).getTime() - toDate(run.startedAt).getTime();
  }

  if (events.length >= 2) {
    return toDate(events[events.length - 1].timestamp).getTime() - toDate(events[0].timestamp).getTime();
  }

  return null;
}

function countBy<T>(items: T[], getKey: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function sum<T>(items: T[], getValue: (item: T) => number): number {
  return items.reduce((total, item) => total + getValue(item), 0);
}

function markdownTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return '_No data available._';
  const headerRow = `| ${headers.map(escapeTableCell).join(' | ')} |`;
  const dividerRow = `| ${headers.map(() => '---').join(' | ')} |`;
  const bodyRows = rows.map((row) => `| ${row.map(escapeTableCell).join(' | ')} |`);
  return [headerRow, dividerRow, ...bodyRows].join('\n');
}

function escapeTableCell(value: string): string {
  return safeText(value).replaceAll('\n', ' ').replaceAll('|', '\\|');
}

function safeText(value: string, maxLength = 240): string {
  const redacted = redactText(value);
  const collapsed = redacted.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function safePathOrUrl(value: string): string {
  const sanitized = redactText(value).trim();
  return sanitized.replace(/\?.*$/, '');
}

function redactText(value: string): string {
  return value
    .replace(/(bearer\s+)[a-z0-9._-]+/gi, '$1[redacted]')
    .replace(/((?:token|password|cookie|secret|authorization|api[_-]?key)\s*[:=]\s*)([^,\s]+)/gi, '$1[redacted]');
}

function redactObject(payload: Record<string, unknown>): Record<string, unknown> {
  const sensitive = ['password', 'token', 'cookie', 'authorization', 'secret', 'apiKey'];
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => {
      if (sensitive.some((item) => key.toLowerCase().includes(item.toLowerCase()))) {
        return [key, '[redacted]'];
      }
      if (typeof value === 'string') return [key, safeText(value)];
      return [key, value];
    })
  );
}

function normalizeSeverity(value: string): DerivedFinding['severity'] {
  const normalized = value.toUpperCase();
  if (normalized === 'CRITICAL') return 'Critical';
  if (normalized === 'HIGH') return 'High';
  if (normalized === 'MEDIUM') return 'Medium';
  return 'Low';
}

function compareFindings(left: DerivedFinding, right: DerivedFinding): number {
  return severityRank(right.severity) - severityRank(left.severity) || left.title.localeCompare(right.title);
}

function severityRank(value: DerivedFinding['severity']): number {
  switch (value) {
    case 'Critical':
      return 4;
    case 'High':
      return 3;
    case 'Medium':
      return 2;
    case 'Low':
      return 1;
  }
}

function uniqueText(value: string, index: number, items: string[]): boolean {
  return items.findIndex((candidate) => candidate === value) === index;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function formatDate(value: Date | string): string {
  return toDate(value).toISOString();
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}

function formatNullableUsd(value: number | null): string {
  return value == null ? 'Unbounded' : formatUsd(value);
}

function formatNullableNumber(value: number | null): string {
  return value == null ? 'Unbounded' : String(value);
}

function formatLabel(value: string): string {
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
