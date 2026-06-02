/* global window, document, fetch, io, React, ReactDOM, Recharts */

function shortSummary(event) {
  const payload = event && typeof event.payload === "object" && event.payload ? event.payload : {};
  if (typeof payload.reason === "string" && payload.reason) return payload.reason;
  if (typeof payload.action === "string" && payload.action) return payload.action;
  if (typeof payload.message === "string" && payload.message) return payload.message;
  if (typeof payload.url === "string" && payload.url) return payload.url;
  const keys = Object.keys(payload);
  if (!keys.length) return "No additional details";
  return keys.slice(0, 3).join(", ");
}

function setStatus(text) {
  const el = document.getElementById("socket-status");
  if (el) el.textContent = text;
}

function extractNumber(payload, key) {
  const value = payload && typeof payload === "object" ? payload[key] : undefined;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildDashboard(events) {
  const sorted = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const totalActions = sorted.filter((event) => event.eventType.startsWith("action.")).length;

  const statusByAgent = new Map();
  for (const event of sorted) {
    if (!event.agentId) continue;
    if (event.eventType === "agent.started") statusByAgent.set(event.agentId, "active");
    if (event.eventType === "agent.completed") statusByAgent.set(event.agentId, "completed");
    if (event.eventType === "agent.failed") statusByAgent.set(event.agentId, "failed");
  }

  const agentRows = [...statusByAgent.entries()].map(([agentId, status]) => ({
    agentId,
    status
  }));

  const activeAgents = agentRows.filter((row) => row.status === "active").length;
  const completedWorkflows = sorted.filter((event) => event.eventType === "workflow.completed").length;
  const failedWorkflows = sorted.filter((event) => event.eventType === "workflow.failed").length;
  const errorsFound = sorted.filter(
    (event) =>
      event.severity === "ERROR" ||
      event.severity === "CRITICAL" ||
      ["console.error", "network.failed", "agent.failed", "run.failed", "action.failed", "workflow.failed"].includes(
        event.eventType
      )
  ).length;

  const completionDurations = [];
  const startedByActionKey = new Map();
  for (const event of sorted) {
    const payload = event.payload || {};
    const directDuration = extractNumber(payload, "durationMs");
    if ((event.eventType === "action.completed" || event.eventType === "workflow.completed") && directDuration !== null) {
      completionDurations.push(directDuration);
      continue;
    }
    const action = typeof payload.action === "string" ? payload.action : "unknown";
    const key = `${event.agentId || "none"}:${action}`;
    if (event.eventType === "action.started") {
      startedByActionKey.set(key, new Date(event.timestamp).getTime());
    }
    if (event.eventType === "action.completed" && startedByActionKey.has(key)) {
      const startedAt = startedByActionKey.get(key);
      const endedAt = new Date(event.timestamp).getTime();
      if (typeof startedAt === "number" && endedAt >= startedAt) completionDurations.push(endedAt - startedAt);
      startedByActionKey.delete(key);
    }
  }

  const avgCompletionTimeMs =
    completionDurations.length > 0
      ? completionDurations.reduce((sum, value) => sum + value, 0) / completionDurations.length
      : null;

  const frustrationValues = sorted
    .map((event) => extractNumber(event.payload || {}, "frustrationScore"))
    .filter((value) => value !== null);
  const avgFrustrationScore =
    frustrationValues.length > 0
      ? frustrationValues.reduce((sum, value) => sum + value, 0) / frustrationValues.length
      : null;

  const llmCostValues = sorted
    .map((event) => extractNumber(event.payload || {}, "llmCostUsd"))
    .filter((value) => value !== null);
  const estimatedLlmCostUsed = llmCostValues.reduce((sum, value) => sum + value, 0);

  const distributionMap = new Map();
  for (const event of sorted) {
    const next = (distributionMap.get(event.eventType) || 0) + 1;
    distributionMap.set(event.eventType, next);
  }
  const eventDistribution = [...distributionMap.entries()]
    .map(([eventType, count]) => ({ eventType, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const personaMap = new Map();
  for (const event of sorted) {
    if (!event.personaId) continue;
    if (!personaMap.has(event.personaId)) {
      personaMap.set(event.personaId, {
        personaId: event.personaId,
        actions: 0,
        completions: 0,
        failures: 0,
        frustrationTotal: 0,
        frustrationCount: 0
      });
    }
    const row = personaMap.get(event.personaId);
    if (event.eventType.startsWith("action.")) row.actions += 1;
    if (event.eventType === "workflow.completed" || event.eventType === "agent.completed") row.completions += 1;
    if (event.eventType === "workflow.failed" || event.eventType === "agent.failed") row.failures += 1;
    const frustration = extractNumber(event.payload || {}, "frustrationScore");
    if (frustration !== null) {
      row.frustrationTotal += frustration;
      row.frustrationCount += 1;
    }
  }
  const personaPerformance = [...personaMap.values()].map((row) => ({
    personaId: row.personaId,
    actions: row.actions,
    completions: row.completions,
    failures: row.failures,
    avgFrustration: row.frustrationCount > 0 ? row.frustrationTotal / row.frustrationCount : null
  }));

  const recentErrors = sorted
    .filter(
      (event) =>
        event.severity === "ERROR" ||
        event.severity === "CRITICAL" ||
        event.eventType.endsWith(".failed") ||
        event.eventType === "console.error" ||
        event.eventType === "network.failed"
    )
    .slice(-8)
    .reverse();

  return {
    cards: {
      totalActions,
      activeAgents,
      completedWorkflows,
      failedWorkflows,
      errorsFound,
      avgCompletionTimeMs,
      avgFrustrationScore,
      estimatedLlmCostUsed
    },
    agentRows,
    eventDistribution,
    personaPerformance,
    recentErrors,
    liveEvents: [...sorted].reverse().slice(0, 100)
  };
}

function useRunEvents(config) {
  const [events, setEvents] = React.useState(Array.isArray(config.initialEvents) ? [...config.initialEvents] : []);
  const [artifacts, setArtifacts] = React.useState(
    Array.isArray(config.initialArtifacts) ? [...config.initialArtifacts] : []
  );
  const [budgetSummary, setBudgetSummary] = React.useState(null);
  const seenRef = React.useRef(new Set(events.map((event) => event.id)));
  const artifactSeenRef = React.useRef(new Set(artifacts.map((artifact) => artifact.id)));

  React.useEffect(() => {
    artifactSeenRef.current = new Set(artifacts.map((artifact) => artifact.id));
  }, [artifacts]);

  React.useEffect(() => {
    let mounted = true;
    const socket = io(config.apiBaseUrl, { withCredentials: true, reconnection: true });

    async function fetchArtifacts() {
      const response = await fetch(`${config.apiBaseUrl}/api/runs/${config.runId}/artifacts`, {
        method: "GET",
        credentials: "include"
      });
      if (!response.ok || !mounted) return;
      const payload = await response.json();
      const nextArtifacts = Array.isArray(payload.artifacts) ? payload.artifacts : [];
      setArtifacts((prev) => {
        const merged = [...prev];
        for (const artifact of nextArtifacts) {
          if (!artifactSeenRef.current.has(artifact.id)) {
            artifactSeenRef.current.add(artifact.id);
            merged.push(artifact);
          }
        }
        return merged;
      });
    }

    async function fetchHistorical() {
      const response = await fetch(`${config.apiBaseUrl}/api/runs/${config.runId}/events`, {
        method: "GET",
        credentials: "include"
      });
      if (!response.ok || !mounted) return;
      const payload = await response.json();
      const nextEvents = Array.isArray(payload.events) ? payload.events : [];
      setEvents((prev) => {
        const merged = [...prev];
        for (const event of nextEvents) {
          if (!seenRef.current.has(event.id)) {
            seenRef.current.add(event.id);
            merged.push(event);
          }
        }
        return merged;
      });
    }

    const onEvent = (event) => {
      if (!event || !event.id || seenRef.current.has(event.id)) return;
      seenRef.current.add(event.id);
      setEvents((prev) => [...prev, event]);
      if (event.eventType === "artifact.created") {
        void fetchArtifacts();
      }
    };

    socket.on("connect", () => {
      setStatus("Live feed connected");
      socket.emit("subscribe", { channel: `run:${config.runId}` });
    });
    socket.on("reconnect", () => {
      setStatus("Live feed reconnected");
      socket.emit("subscribe", { channel: `run:${config.runId}` });
      void fetchHistorical();
    });
    socket.on("disconnect", () => setStatus("Live feed disconnected; attempting reconnect"));
    socket.on("subscription.error", (error) => {
      const msg = error && error.message ? error.message : "Subscription failed";
      setStatus(`Subscription error: ${msg}`);
    });
    socket.on("event.created", onEvent);

    void fetchHistorical();
    void fetchArtifacts();

    return () => {
      mounted = false;
      socket.off("event.created", onEvent);
      socket.disconnect();
    };
  }, [config.apiBaseUrl, config.runId]);

  React.useEffect(() => {
    async function fetchArtifacts() {
      const response = await fetch(`${config.apiBaseUrl}/api/runs/${config.runId}/artifacts`, {
        method: "GET",
        credentials: "include"
      });
      if (!response.ok) return;
      const payload = await response.json();
      const nextArtifacts = Array.isArray(payload.artifacts) ? payload.artifacts : [];
      setArtifacts((prev) => {
        const merged = [...prev];
        for (const artifact of nextArtifacts) {
          if (!artifactSeenRef.current.has(artifact.id)) {
            artifactSeenRef.current.add(artifact.id);
            merged.push(artifact);
          }
        }
        return merged;
      });
    }

    void fetchArtifacts();
  }, [config.apiBaseUrl, config.runId]);

  React.useEffect(() => {
    let timer = null;

    async function fetchBudgetSummary() {
      const response = await fetch(`${config.apiBaseUrl}/api/runs/${config.runId}/budget-summary`, {
        method: "GET",
        credentials: "include"
      });
      if (!response.ok) return;
      const payload = await response.json();
      if (payload && payload.summary) setBudgetSummary(payload.summary);
    }

    void fetchBudgetSummary();
    timer = window.setInterval(() => {
      void fetchBudgetSummary();
    }, 5000);

    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [config.apiBaseUrl, config.runId]);

  return { events, artifacts, budgetSummary };
}

function MetricCard({ title, value, subtitle }) {
  return React.createElement(
    "div",
    { className: "rounded-xl border border-slate-200 bg-slate-50 p-4" },
    React.createElement("p", { className: "text-xs uppercase tracking-wide text-slate-500" }, title),
    React.createElement("p", { className: "mt-2 text-2xl font-semibold text-slate-900" }, value),
    React.createElement("p", { className: "mt-1 text-xs text-slate-500" }, subtitle || "")
  );
}

function DashboardApp({ config }) {
  const { events, artifacts, budgetSummary } = useRunEvents(config);
  const dashboard = React.useMemo(() => buildDashboard(events), [events]);
  const rc = Recharts;
  const latestReport = artifacts
    .filter((artifact) => artifact.type === "REPORT")
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  const cards = dashboard.cards;
  const avgCompletionLabel = cards.avgCompletionTimeMs === null ? "n/a" : `${Math.round(cards.avgCompletionTimeMs)} ms`;
  const avgFrustrationLabel = cards.avgFrustrationScore === null ? "n/a" : cards.avgFrustrationScore.toFixed(1);
  const llmCostLabel = `$${cards.estimatedLlmCostUsed.toFixed(2)}`;
  const budgetCostUsed = budgetSummary ? `$${Number(budgetSummary.totals.estimatedCostUsd || 0).toFixed(4)}` : "n/a";
  const budgetTokensUsed = budgetSummary ? String(budgetSummary.totals.totalTokens || 0) : "n/a";
  const budgetRemainingCost =
    budgetSummary && budgetSummary.remaining && budgetSummary.remaining.cost !== null
      ? `$${Number(budgetSummary.remaining.cost).toFixed(4)}`
      : "unbounded";
  const projectedCost =
    budgetSummary && budgetSummary.projected && budgetSummary.projected.next1000TokensCost !== null
      ? `$${Number(budgetSummary.projected.next1000TokensCost).toFixed(4)} / 1k tokens`
      : "n/a";

  return React.createElement(
    "div",
    { className: "space-y-6" },
    latestReport
      ? React.createElement(
          "div",
          { className: "flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3" },
          React.createElement(
            "div",
            null,
            React.createElement("p", { className: "text-sm font-semibold text-emerald-900" }, "Executive report ready"),
            React.createElement("p", { className: "text-xs text-emerald-800" }, "Open the generated markdown summary for this run.")
          ),
          React.createElement(
            "a",
            {
              className: "rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white no-underline",
              href: getArtifactHref(latestReport, config),
              target: "_blank",
              rel: "noreferrer"
            },
            "Open report"
          )
        )
      : null,
    React.createElement(
      "div",
      { className: "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" },
      React.createElement(MetricCard, { title: "Total Actions", value: String(cards.totalActions), subtitle: "action.* events" }),
      React.createElement(MetricCard, { title: "Active Agents", value: String(cards.activeAgents), subtitle: "currently running" }),
      React.createElement(MetricCard, { title: "Completed Workflows", value: String(cards.completedWorkflows), subtitle: "workflow.completed" }),
      React.createElement(MetricCard, { title: "Failed Workflows", value: String(cards.failedWorkflows), subtitle: "workflow.failed" }),
      React.createElement(MetricCard, { title: "Errors Found", value: String(cards.errorsFound), subtitle: "severity + failed events" }),
      React.createElement(MetricCard, { title: "Average Completion Time", value: avgCompletionLabel, subtitle: "from durationMs / action spans" }),
      React.createElement(MetricCard, { title: "Average Frustration Score", value: avgFrustrationLabel, subtitle: "from payload.frustrationScore" }),
      React.createElement(MetricCard, { title: "Estimated LLM Cost Used", value: llmCostLabel, subtitle: "from payload.llmCostUsd" }),
      React.createElement(MetricCard, { title: "Budget Cost Used", value: budgetCostUsed, subtitle: "from tracked llm usage" }),
      React.createElement(MetricCard, { title: "Budget Tokens Used", value: budgetTokensUsed, subtitle: "input + output tokens" }),
      React.createElement(MetricCard, { title: "Remaining Budget", value: budgetRemainingCost, subtitle: "remaining run cost cap" }),
      React.createElement(MetricCard, { title: "Projected Cost", value: projectedCost, subtitle: "estimated next 1k tokens" })
    ),
    React.createElement(
      "div",
      { className: "grid grid-cols-1 gap-4 xl:grid-cols-3" },
      React.createElement(
        "section",
        { className: "rounded-xl border border-slate-200 bg-white p-4 xl:col-span-2" },
        React.createElement("h3", { className: "text-sm font-semibold text-slate-900" }, "Live Event Feed"),
        React.createElement(
          "div",
          { className: "mt-3 max-h-[320px] overflow-y-auto" },
          dashboard.liveEvents.length === 0
            ? React.createElement("p", { className: "text-sm text-slate-500" }, "No events yet.")
            : dashboard.liveEvents.map((event) =>
                React.createElement(
                  "div",
                  { key: event.id, className: "mb-2 rounded-lg border border-slate-200 p-3" },
                  React.createElement(
                    "div",
                    { className: "flex items-center justify-between gap-2 text-xs text-slate-500" },
                    React.createElement("span", null, new Date(event.timestamp).toLocaleString()),
                    React.createElement("span", { className: "font-mono text-[11px]" }, event.agentId || "-")
                  ),
                  React.createElement(
                    "div",
                    { className: "mt-1 flex items-center gap-2" },
                    React.createElement("span", { className: "rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700" }, event.eventType),
                    React.createElement("span", { className: "text-xs text-slate-500" }, event.severity)
                  ),
                  React.createElement("p", { className: "mt-2 text-sm text-slate-700" }, shortSummary(event))
                )
              )
        )
      ),
      React.createElement(
        "section",
        { className: "rounded-xl border border-slate-200 bg-white p-4" },
        React.createElement("h3", { className: "text-sm font-semibold text-slate-900" }, "Recent Errors"),
        React.createElement(
          "div",
          { className: "mt-3 space-y-2" },
          dashboard.recentErrors.length === 0
            ? React.createElement("p", { className: "text-sm text-slate-500" }, "No errors recorded.")
            : dashboard.recentErrors.map((event) =>
                React.createElement(
                  "div",
                  { key: event.id, className: "rounded-lg border border-rose-200 bg-rose-50 p-3" },
                  React.createElement("p", { className: "text-xs font-semibold text-rose-700" }, event.eventType),
                  React.createElement("p", { className: "mt-1 text-xs text-rose-700" }, shortSummary(event))
                )
              )
        )
      )
    ),
    React.createElement(
      "div",
      { className: "grid grid-cols-1 gap-4 xl:grid-cols-2" },
      React.createElement(
        "section",
        { className: "rounded-xl border border-slate-200 bg-white p-4" },
        React.createElement("h3", { className: "text-sm font-semibold text-slate-900" }, "Agent Status Table"),
        React.createElement(
          "div",
          { className: "mt-3 overflow-x-auto" },
          React.createElement(
            "table",
            { className: "min-w-full text-sm" },
            React.createElement(
              "thead",
              { className: "text-left text-slate-500" },
              React.createElement(
                "tr",
                null,
                React.createElement("th", { className: "pb-2" }, "Agent"),
                React.createElement("th", { className: "pb-2" }, "Status")
              )
            ),
            React.createElement(
              "tbody",
              null,
              dashboard.agentRows.length === 0
                ? React.createElement(
                    "tr",
                    null,
                    React.createElement("td", { colSpan: 2, className: "py-2 text-slate-500" }, "No agent events yet.")
                  )
                : dashboard.agentRows.map((row) =>
                    React.createElement(
                      "tr",
                      { key: row.agentId, className: "border-t border-slate-100" },
                      React.createElement("td", { className: "py-2 font-mono text-xs text-slate-700" }, row.agentId),
                      React.createElement("td", { className: "py-2 capitalize text-slate-700" }, row.status)
                    )
                  )
            )
          )
        )
      ),
      React.createElement(
        "section",
        { className: "rounded-xl border border-slate-200 bg-white p-4" },
        React.createElement("h3", { className: "text-sm font-semibold text-slate-900" }, "Event Distribution"),
        React.createElement(
          "div",
          { className: "mt-3 h-[260px]" },
          React.createElement(
            rc.ResponsiveContainer,
            { width: "100%", height: "100%" },
            React.createElement(
              rc.BarChart,
              { data: dashboard.eventDistribution },
              React.createElement(rc.CartesianGrid, { strokeDasharray: "3 3" }),
              React.createElement(rc.XAxis, { dataKey: "eventType", tick: { fontSize: 10 }, interval: 0, angle: -20, textAnchor: "end", height: 70 }),
              React.createElement(rc.YAxis, { allowDecimals: false }),
              React.createElement(rc.Tooltip, null),
              React.createElement(rc.Bar, { dataKey: "count", fill: "#2563eb", radius: [4, 4, 0, 0] })
            )
          )
        )
      )
    ),
    React.createElement(
      "section",
      { className: "rounded-xl border border-slate-200 bg-white p-4" },
      React.createElement("h3", { className: "text-sm font-semibold text-slate-900" }, "Persona Performance Summary"),
      React.createElement(
        "div",
        { className: "mt-3 overflow-x-auto" },
        React.createElement(
          "table",
          { className: "min-w-full text-sm" },
          React.createElement(
            "thead",
            { className: "text-left text-slate-500" },
            React.createElement(
              "tr",
              null,
              React.createElement("th", { className: "pb-2" }, "Persona"),
              React.createElement("th", { className: "pb-2" }, "Actions"),
              React.createElement("th", { className: "pb-2" }, "Completions"),
              React.createElement("th", { className: "pb-2" }, "Failures"),
              React.createElement("th", { className: "pb-2" }, "Avg Frustration")
            )
          ),
          React.createElement(
            "tbody",
            null,
            dashboard.personaPerformance.length === 0
              ? React.createElement(
                  "tr",
                  null,
                  React.createElement("td", { colSpan: 5, className: "py-2 text-slate-500" }, "No persona-linked events yet.")
                )
              : dashboard.personaPerformance.map((row) =>
                  React.createElement(
                    "tr",
                    { key: row.personaId, className: "border-t border-slate-100" },
                    React.createElement("td", { className: "py-2 font-mono text-xs text-slate-700" }, row.personaId),
                    React.createElement("td", { className: "py-2 text-slate-700" }, String(row.actions)),
                    React.createElement("td", { className: "py-2 text-slate-700" }, String(row.completions)),
                    React.createElement("td", { className: "py-2 text-slate-700" }, String(row.failures)),
                    React.createElement(
                      "td",
                      { className: "py-2 text-slate-700" },
                      row.avgFrustration === null ? "n/a" : row.avgFrustration.toFixed(1)
                    )
                  )
                )
          )
        )
      )
    ),
    React.createElement(
      "section",
      { className: "rounded-xl border border-slate-200 bg-white p-4" },
      React.createElement("h3", { className: "text-sm font-semibold text-slate-900" }, "Artifacts"),
      React.createElement(
        "div",
        { className: "mt-3 space-y-2" },
        artifacts.length === 0
          ? React.createElement("p", { className: "text-sm text-slate-500" }, "No artifacts yet.")
          : artifacts
              .slice()
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((artifact) =>
                React.createElement(
                  "div",
                  { key: artifact.id, className: "rounded-lg border border-slate-200 p-3 text-sm" },
                  React.createElement(
                    "div",
                    { className: "flex items-center justify-between gap-2" },
                    React.createElement("span", { className: "font-medium text-slate-800" }, artifact.type),
                    React.createElement(
                      "span",
                      { className: "text-xs text-slate-500" },
                      new Date(artifact.createdAt).toLocaleString()
                    )
                  ),
                  React.createElement(
                    "a",
                    {
                      className: "mt-1 block break-all text-xs text-blue-600 underline",
                      href: getArtifactHref(artifact, config),
                      target: "_blank",
                      rel: "noreferrer"
                    },
                    artifact.uri
                  )
                )
              )
      )
    )
  );
}

function getArtifactHref(artifact, config) {
  if (!artifact || !artifact.uri) return "#";
  if (/^https?:\/\//i.test(artifact.uri)) return artifact.uri;
  return `${config.apiBaseUrl}/api/runs/${config.runId}/artifacts/${artifact.id}/content`;
}

function mount() {
  const config = window.__RUN_EVENTS_CONFIG__;
  const rootEl = document.getElementById("run-dashboard-root");
  if (!config || !rootEl) return;

  const root = ReactDOM.createRoot(rootEl);
  root.render(React.createElement(DashboardApp, { config }));
}

mount();
