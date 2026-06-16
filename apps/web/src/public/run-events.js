/* global window, document, fetch, io, React, ReactDOM, Recharts */

function shortSummary(event) {
  const payload = event && typeof event.payload === "object" && event.payload ? event.payload : {};
  if (typeof payload.reason === "string" && payload.reason) return payload.reason;
  if (typeof payload.error === "string" && payload.error) return payload.error;
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

function deriveRunStatus(events) {
  const sorted = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  if (sorted.some((event) => event.eventType === "run.cancelled")) return "Cancelled";
  if (sorted.some((event) => event.eventType === "run.failed")) return "Failed";
  if (sorted.some((event) => event.eventType === "run.completed")) return "Completed";
  if (sorted.some((event) => event.eventType === "run.started")) return "Running";
  return "Pending";
}

function deriveActiveAgents(events) {
  const sorted = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const statusByAgent = new Map();

  for (const event of sorted) {
    if (!event.agentId) continue;
    if (event.eventType === "agent.started") statusByAgent.set(event.agentId, "active");
    if (event.eventType === "agent.completed") statusByAgent.set(event.agentId, "completed");
    if (event.eventType === "agent.failed") statusByAgent.set(event.agentId, "failed");
    if (event.eventType === "agent.cancelled") statusByAgent.set(event.agentId, "cancelled");
  }

  return [...statusByAgent.entries()]
    .filter(([, status]) => status === "active")
    .map(([agentId]) => agentId)
    .sort((left, right) => left.localeCompare(right));
}

function publishNexusAgents(events) {
  window.dispatchEvent(
    new CustomEvent("nexus:agents", {
      detail: {
        activeAgents: deriveActiveAgents(events)
      }
    })
  );
}

function buildDashboard(events) {
  const sorted = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const totalActions = sorted.filter((event) => event.eventType.startsWith("action.")).length;
  const totalAgents = new Set(sorted.filter((event) => event.agentId).map((event) => event.agentId)).size;
  const statusByAgent = new Map();
  const actionCountByAgent = new Map();
  const lastEventByAgent = new Map();

  for (const event of sorted) {
    if (!event.agentId) continue;
    lastEventByAgent.set(event.agentId, event);
    if (event.eventType.startsWith("action.")) {
      actionCountByAgent.set(event.agentId, (actionCountByAgent.get(event.agentId) || 0) + 1);
    }
    if (event.eventType === "agent.started") statusByAgent.set(event.agentId, "active");
    if (event.eventType === "agent.completed") statusByAgent.set(event.agentId, "completed");
    if (event.eventType === "agent.failed") statusByAgent.set(event.agentId, "failed");
  }

  const agentRows = [...new Set([...statusByAgent.keys(), ...actionCountByAgent.keys(), ...lastEventByAgent.keys()])]
    .map((agentId) => ({
      agentId,
      status: statusByAgent.get(agentId) || "pending",
      actions: actionCountByAgent.get(agentId) || 0,
      lastEventType: lastEventByAgent.get(agentId)?.eventType || "No events yet",
      lastUpdatedAt: lastEventByAgent.get(agentId)?.timestamp || null
    }))
    .sort((left, right) => left.agentId.localeCompare(right.agentId));

  const completedAgents = agentRows.filter((row) => row.status === "completed").length;
  const failedAgents = agentRows.filter((row) => row.status === "failed").length;
  const activeAgents = agentRows.filter((row) => row.status === "active").length;

  const recentErrors = sorted
    .filter(
      (event) =>
        event.severity === "ERROR" ||
        event.severity === "CRITICAL" ||
        event.eventType.endsWith(".failed") ||
        event.eventType === "console.error" ||
        event.eventType === "network.failed"
    )
    .slice(-10)
    .reverse();

  const distributionMap = new Map();
  for (const event of sorted) {
    distributionMap.set(event.eventType, (distributionMap.get(event.eventType) || 0) + 1);
  }
  const eventDistribution = [...distributionMap.entries()]
    .map(([eventType, count]) => ({ eventType, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const frustrationValues = sorted
    .map((event) => extractNumber(event.payload || {}, "frustrationScore"))
    .filter((value) => value !== null);
  const avgFrustrationScore =
    frustrationValues.length > 0
      ? frustrationValues.reduce((sum, value) => sum + value, 0) / frustrationValues.length
      : null;

  const completionDurations = sorted
    .map((event) => extractNumber(event.payload || {}, "durationMs"))
    .filter((value) => value !== null);
  const avgCompletionTimeMs =
    completionDurations.length > 0
      ? completionDurations.reduce((sum, value) => sum + value, 0) / completionDurations.length
      : null;

  return {
    runStatus: deriveRunStatus(sorted),
    cards: {
      totalActions,
      totalAgents,
      activeAgents,
      completedAgents,
      failedAgents,
      errorsFound: recentErrors.length,
      avgCompletionTimeMs,
      avgFrustrationScore
    },
    agentRows,
    eventDistribution,
    recentErrors,
    liveEvents: [...sorted].reverse().slice(0, 80)
  };
}

async function fetchJson(url) {
  const response = await fetch(url, { method: "GET", credentials: "include" });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json();
}

function useRunData(config) {
  const [events, setEvents] = React.useState(Array.isArray(config.initialEvents) ? [...config.initialEvents] : []);
  const [artifacts, setArtifacts] = React.useState(Array.isArray(config.initialArtifacts) ? [...config.initialArtifacts] : []);
  const [findings, setFindings] = React.useState(Array.isArray(config.initialFindings) ? [...config.initialFindings] : []);
  const [budgetSummary, setBudgetSummary] = React.useState(null);
  const [loading, setLoading] = React.useState(events.length === 0);
  const [error, setError] = React.useState("");
  const seenEventsRef = React.useRef(new Set(events.map((event) => event.id)));

  React.useEffect(() => {
    let mounted = true;
    const socket = io(config.apiBaseUrl, { withCredentials: true, reconnection: true });

    async function refreshArtifacts() {
      try {
        const payload = await fetchJson(`${config.apiBaseUrl}/api/runs/${config.runId}/artifacts`);
        if (!mounted) return;
        setArtifacts(Array.isArray(payload.artifacts) ? payload.artifacts : []);
      } catch {
        // keep current artifact view
      }
    }

    async function refreshEvents() {
      try {
        const payload = await fetchJson(`${config.apiBaseUrl}/api/runs/${config.runId}/events`);
        if (!mounted) return;
        const nextEvents = Array.isArray(payload.events) ? payload.events : [];
        seenEventsRef.current = new Set(nextEvents.map((event) => event.id));
        setEvents(nextEvents);
        setLoading(false);
        setError("");
      } catch (requestError) {
        if (!mounted) return;
        setLoading(false);
        setError(requestError instanceof Error ? requestError.message : "Unable to load run events");
      }
    }

    async function refreshFindings() {
      try {
        const payload = await fetchJson(`${config.apiBaseUrl}/api/runs/${config.runId}/findings`);
        if (!mounted) return;
        setFindings(Array.isArray(payload.findings) ? payload.findings : []);
      } catch {
        // findings are optional during active runs
      }
    }

    async function refreshBudgetSummary() {
      try {
        const payload = await fetchJson(`${config.apiBaseUrl}/api/runs/${config.runId}/budget-summary`);
        if (!mounted) return;
        setBudgetSummary(payload.summary || null);
      } catch {
        // keep current budget summary
      }
    }

    const onEvent = (event) => {
      if (!event || !event.id || seenEventsRef.current.has(event.id)) return;
      seenEventsRef.current.add(event.id);
      setEvents((prev) => [...prev, event]);
      setLoading(false);
      if (event.eventType === "artifact.created" || event.eventType === "run.completed" || event.eventType === "run.failed") {
        void refreshArtifacts();
        void refreshFindings();
      }
    };

    socket.on("connect", () => {
      setStatus("Live feed connected");
      socket.emit("subscribe", { channel: `run:${config.runId}` });
    });
    socket.on("reconnect", () => {
      setStatus("Live feed reconnected");
      socket.emit("subscribe", { channel: `run:${config.runId}` });
      void refreshEvents();
      void refreshArtifacts();
      void refreshFindings();
    });
    socket.on("disconnect", () => setStatus("Live feed disconnected; attempting reconnect"));
    socket.on("subscription.error", (socketError) => {
      const message = socketError && socketError.message ? socketError.message : "Subscription failed";
      setStatus(`Subscription error: ${message}`);
    });
    socket.on("event.created", onEvent);

    void refreshEvents();
    void refreshArtifacts();
    void refreshFindings();
    void refreshBudgetSummary();

    const budgetTimer = window.setInterval(() => {
      void refreshBudgetSummary();
    }, 5000);
    const findingsTimer = window.setInterval(() => {
      void refreshFindings();
    }, 8000);

    return () => {
      mounted = false;
      window.clearInterval(budgetTimer);
      window.clearInterval(findingsTimer);
      socket.off("event.created", onEvent);
      socket.disconnect();
    };
  }, [config.apiBaseUrl, config.runId]);

  return { events, artifacts, findings, budgetSummary, loading, error };
}

function MetricCard({ title, value, subtitle, tone }) {
  const toneClass =
    tone === "danger"
      ? "border-rose-200 bg-rose-50"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50"
        : "border-slate-200 bg-slate-50";
  return React.createElement(
    "div",
    { className: `rounded-xl border p-4 ${toneClass}` },
    React.createElement("p", { className: "text-xs uppercase tracking-wide text-slate-500" }, title),
    React.createElement("p", { className: "mt-2 text-2xl font-semibold text-slate-900" }, value),
    React.createElement("p", { className: "mt-1 text-xs text-slate-500" }, subtitle || "")
  );
}

function EmptyState({ title, body }) {
  return React.createElement(
    "div",
    { className: "rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600" },
    React.createElement("p", { className: "font-semibold text-slate-800" }, title),
    React.createElement("p", { className: "mt-1" }, body)
  );
}

function DashboardApp({ config }) {
  const { events, artifacts, findings, budgetSummary, loading, error } = useRunData(config);
  const dashboard = React.useMemo(() => buildDashboard(events), [events]);
  const rc = Recharts;

  React.useEffect(() => {
    publishNexusAgents(events);
  }, [events]);

  const [selectedAgentId, setSelectedAgentId] = React.useState(null);
  React.useEffect(() => {
    if (!selectedAgentId && dashboard.agentRows.length > 0) {
      setSelectedAgentId(dashboard.agentRows[0].agentId);
      return;
    }
    if (selectedAgentId && !dashboard.agentRows.some((row) => row.agentId === selectedAgentId) && dashboard.agentRows.length > 0) {
      setSelectedAgentId(dashboard.agentRows[0].agentId);
    }
  }, [dashboard.agentRows, selectedAgentId]);

  const selectedAgentEvents = selectedAgentId
    ? events
        .filter((event) => event.agentId === selectedAgentId)
        .slice()
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    : [];
  const selectedAgentArtifacts = selectedAgentId
    ? artifacts
        .filter((artifact) => artifact.simulationAgentId === selectedAgentId)
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];

  const latestMarkdownReport = artifacts
    .filter((artifact) => artifact.type === "REPORT")
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const latestPdfReport = artifacts
    .filter((artifact) => artifact.type === "REPORT_PDF")
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  const cards = dashboard.cards;
  const avgCompletionLabel = cards.avgCompletionTimeMs === null ? "n/a" : `${Math.round(cards.avgCompletionTimeMs)} ms`;
  const avgFrustrationLabel = cards.avgFrustrationScore === null ? "n/a" : cards.avgFrustrationScore.toFixed(1);
  const budgetCostUsed = budgetSummary ? `$${Number(budgetSummary.totals.estimatedCostUsd || 0).toFixed(4)}` : "n/a";
  const budgetTokensUsed = budgetSummary ? String(budgetSummary.totals.totalTokens || 0) : "n/a";

  return React.createElement(
    "div",
    { className: "space-y-6" },
    latestMarkdownReport || latestPdfReport
      ? React.createElement(
          "div",
          { className: "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3" },
          React.createElement(
            "div",
            null,
            React.createElement("p", { className: "text-sm font-semibold text-emerald-900" }, latestPdfReport ? "Report exports ready" : "Markdown report ready"),
            React.createElement("p", { className: "text-xs text-emerald-800" }, latestPdfReport ? "Download the PDF or open the markdown source report for the executive summary and artifact appendix." : "Open the generated report for the executive summary and artifact appendix.")
          ),
          React.createElement(
            "div",
            { className: "flex flex-wrap gap-2" },
            latestPdfReport
              ? React.createElement(
                  "a",
                  {
                    className: "rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white no-underline",
                    href: getArtifactHref(latestPdfReport, config),
                    target: "_blank",
                    rel: "noreferrer"
                  },
                  "Download PDF report"
                )
              : null,
            latestMarkdownReport
              ? React.createElement(
                  "a",
                  {
                    className: "rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-800 no-underline",
                    href: getArtifactHref(latestMarkdownReport, config),
                    target: "_blank",
                    rel: "noreferrer"
                  },
                  "Open markdown report"
                )
              : null
          )
        )
      : React.createElement(EmptyState, {
          title: "Report pending",
          body: "The markdown source report and PDF export will appear here after the run finishes and the report job completes."
        }),
    error
      ? React.createElement(
          "div",
          { className: "rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" },
          `Dashboard refresh issue: ${error}`
        )
      : null,
    loading
      ? React.createElement(
          "div",
          { className: "rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600" },
          "Loading run activity..."
        )
      : null,
    React.createElement(
      "div",
      { className: "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" },
      React.createElement(MetricCard, { title: "Run Status", value: dashboard.runStatus, subtitle: "derived from live run events", tone: dashboard.runStatus === "Failed" ? "danger" : "success" }),
      React.createElement(MetricCard, { title: "Agents Seen", value: String(cards.totalAgents), subtitle: "agent events received" }),
      React.createElement(MetricCard, { title: "Active Agents", value: String(cards.activeAgents), subtitle: "currently running" }),
      React.createElement(MetricCard, { title: "Completed Agents", value: String(cards.completedAgents), subtitle: "agent.completed" }),
      React.createElement(MetricCard, { title: "Failed Agents", value: String(cards.failedAgents), subtitle: "agent.failed", tone: cards.failedAgents > 0 ? "danger" : "default" }),
      React.createElement(MetricCard, { title: "Total Actions", value: String(cards.totalActions), subtitle: "action.* events" }),
      React.createElement(MetricCard, { title: "Avg Action Time", value: avgCompletionLabel, subtitle: "from action durationMs" }),
      React.createElement(MetricCard, { title: "Avg Frustration", value: avgFrustrationLabel, subtitle: "from frustrationScore" }),
      React.createElement(MetricCard, { title: "Findings", value: String(findings.length), subtitle: "current run findings" }),
      React.createElement(MetricCard, { title: "Artifacts", value: String(artifacts.length), subtitle: "screenshots, traces, videos, report" }),
      React.createElement(MetricCard, { title: "Budget Cost Used", value: budgetCostUsed, subtitle: "tracked LLM usage" }),
      React.createElement(MetricCard, { title: "Budget Tokens", value: budgetTokensUsed, subtitle: "input + output tokens" })
    ),
    React.createElement(
      "div",
      { className: "grid grid-cols-1 gap-4 2xl:grid-cols-[1.2fr_0.8fr]" },
      React.createElement(
        "section",
        { className: "rounded-xl border border-slate-200 bg-white p-4" },
        React.createElement("h3", { className: "text-sm font-semibold text-slate-900" }, "Agent Activity"),
        React.createElement("p", { className: "mt-1 text-sm text-slate-500" }, "Click an agent row to focus its event trail and artifacts."),
        React.createElement(
          "div",
          { className: "mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]" },
          React.createElement(
            "div",
            { className: "overflow-x-auto" },
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
                  React.createElement("th", { className: "pb-2" }, "Status"),
                  React.createElement("th", { className: "pb-2" }, "Actions"),
                  React.createElement("th", { className: "pb-2" }, "Last event")
                )
              ),
              React.createElement(
                "tbody",
                null,
                dashboard.agentRows.length === 0
                  ? React.createElement(
                      "tr",
                      null,
                      React.createElement("td", { colSpan: 4, className: "py-3 text-slate-500" }, "No agent events yet.")
                    )
                  : dashboard.agentRows.map((row) =>
                      React.createElement(
                        "tr",
                        {
                          key: row.agentId,
                          className: `border-t border-slate-100 ${selectedAgentId === row.agentId ? "bg-amber-50" : ""}`
                        },
                        React.createElement(
                          "td",
                          { className: "py-2" },
                          React.createElement(
                            "button",
                            {
                              type: "button",
                              className: "rounded-md bg-transparent px-0 py-0 text-left font-mono text-xs text-slate-700 hover:text-teal-700",
                              onClick: () => setSelectedAgentId(row.agentId)
                            },
                            row.agentId
                          )
                        ),
                        React.createElement("td", { className: "py-2 capitalize text-slate-700" }, row.status),
                        React.createElement("td", { className: "py-2 text-slate-700" }, String(row.actions)),
                        React.createElement("td", { className: "py-2 text-slate-500" }, row.lastEventType)
                      )
                    )
              )
            )
          ),
          React.createElement(
            "div",
            { className: "space-y-3" },
            selectedAgentId
              ? React.createElement(
                  React.Fragment,
                  null,
                  React.createElement(
                    "div",
                    { className: "rounded-xl border border-slate-200 bg-slate-50 p-3" },
                    React.createElement("p", { className: "text-xs uppercase tracking-wide text-slate-500" }, "Selected agent"),
                    React.createElement("p", { className: "mt-1 font-mono text-sm text-slate-800" }, selectedAgentId),
                    React.createElement("p", { className: "mt-1 text-xs text-slate-500" }, `${selectedAgentEvents.length} events · ${selectedAgentArtifacts.length} artifacts`)
                  ),
                  React.createElement(
                    "div",
                    { className: "rounded-xl border border-slate-200 p-3" },
                    React.createElement("h4", { className: "text-sm font-semibold text-slate-900" }, "Recent agent events"),
                    React.createElement(
                      "div",
                      { className: "mt-3 max-h-[260px] space-y-2 overflow-y-auto" },
                      selectedAgentEvents.length === 0
                        ? React.createElement(EmptyState, { title: "No agent events yet", body: "This agent has not emitted any visible events yet." })
                        : selectedAgentEvents.slice(0, 20).map((event) =>
                            React.createElement(
                              "div",
                              { key: event.id, className: "rounded-lg border border-slate-200 p-3" },
                              React.createElement("div", { className: "text-xs text-slate-500" }, new Date(event.timestamp).toLocaleString()),
                              React.createElement("div", { className: "mt-1 flex items-center gap-2" },
                                React.createElement("span", { className: "rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700" }, event.eventType),
                                React.createElement("span", { className: "text-xs text-slate-500" }, event.severity)
                              ),
                              React.createElement("p", { className: "mt-2 text-sm text-slate-700" }, shortSummary(event))
                            )
                          )
                    )
                  ),
                  React.createElement(
                    "div",
                    { className: "rounded-xl border border-slate-200 p-3" },
                    React.createElement("h4", { className: "text-sm font-semibold text-slate-900" }, "Agent artifacts"),
                    React.createElement(
                      "div",
                      { className: "mt-3 space-y-2" },
                      selectedAgentArtifacts.length === 0
                        ? React.createElement(EmptyState, { title: "No artifacts yet", body: "Screenshots, traces, and videos will appear here if this agent produces them." })
                        : selectedAgentArtifacts.slice(0, 8).map((artifact) =>
                            React.createElement(
                              "a",
                              {
                                key: artifact.id,
                                className: "block rounded-lg border border-slate-200 p-3 text-sm text-slate-700 no-underline hover:border-teal-300 hover:bg-teal-50",
                                href: getArtifactHref(artifact, config),
                                target: "_blank",
                                rel: "noreferrer"
                              },
                              React.createElement("div", { className: "font-medium text-slate-900" }, artifact.type),
                              React.createElement("div", { className: "mt-1 text-xs text-slate-500" }, new Date(artifact.createdAt).toLocaleString()),
                              React.createElement("div", { className: "mt-1 break-all text-xs text-slate-500" }, artifact.uri)
                            )
                          )
                    )
                  )
                )
              : React.createElement(EmptyState, { title: "No agent selected", body: "Agent-specific activity will appear here once agent events start arriving." })
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
            ? React.createElement(EmptyState, { title: "No errors recorded", body: "This run has not emitted any console, network, or failed-action errors yet." })
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
      { className: "grid grid-cols-1 gap-4 xl:grid-cols-3" },
      React.createElement(
        "section",
        { className: "rounded-xl border border-slate-200 bg-white p-4 xl:col-span-2" },
        React.createElement("h3", { className: "text-sm font-semibold text-slate-900" }, "Live Event Feed"),
        React.createElement(
          "div",
          { className: "mt-3 max-h-[360px] overflow-y-auto" },
          dashboard.liveEvents.length === 0
            ? React.createElement(EmptyState, { title: "No events yet", body: "The event stream will populate here once the run starts emitting activity." })
            : dashboard.liveEvents.map((event) =>
                React.createElement(
                  "div",
                  { key: event.id, className: "mb-2 rounded-lg border border-slate-200 p-3" },
                  React.createElement(
                    "div",
                    { className: "flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500" },
                    React.createElement("span", null, new Date(event.timestamp).toLocaleString()),
                    React.createElement("span", { className: "font-mono text-[11px]" }, event.agentId || "run")
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
        React.createElement("h3", { className: "text-sm font-semibold text-slate-900" }, "Findings"),
        React.createElement(
          "div",
          { className: "mt-3 space-y-3" },
          findings.length === 0
            ? React.createElement(EmptyState, { title: "No findings yet", body: "Findings usually appear once the run finishes and the report pipeline analyzes the event stream." })
            : findings.map((finding) =>
                React.createElement(
                  "div",
                  { key: finding.id, className: "rounded-lg border border-slate-200 p-3" },
                  React.createElement("div", { className: "flex items-center justify-between gap-2" },
                    React.createElement("p", { className: "text-sm font-semibold text-slate-900" }, finding.title),
                    React.createElement("span", { className: "rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800" }, finding.severity)
                  ),
                  React.createElement("p", { className: "mt-2 text-sm text-slate-700" }, finding.summary),
                  React.createElement("p", { className: "mt-2 text-xs text-slate-500" }, finding.recommendation)
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
        React.createElement("h3", { className: "text-sm font-semibold text-slate-900" }, "Event Distribution"),
        React.createElement(
          "div",
          { className: "mt-3 h-[280px]" },
          dashboard.eventDistribution.length === 0
            ? React.createElement(EmptyState, { title: "No distribution yet", body: "Charts will render after the run produces events." })
            : React.createElement(
                rc.ResponsiveContainer,
                { width: "100%", height: "100%" },
                React.createElement(
                  rc.BarChart,
                  { data: dashboard.eventDistribution },
                  React.createElement(rc.CartesianGrid, { strokeDasharray: "3 3" }),
                  React.createElement(rc.XAxis, { dataKey: "eventType", tick: { fontSize: 10 }, interval: 0, angle: -18, textAnchor: "end", height: 64 }),
                  React.createElement(rc.YAxis, { allowDecimals: false }),
                  React.createElement(rc.Tooltip, null),
                  React.createElement(rc.Bar, { dataKey: "count", fill: "#0f766e", radius: [4, 4, 0, 0] })
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
            ? React.createElement(EmptyState, { title: "No artifacts yet", body: "Artifacts will appear as screenshots, traces, videos, and the final report are created." })
            : artifacts
                .slice()
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((artifact) =>
                  React.createElement(
                    "a",
                    {
                      key: artifact.id,
                      className: "block rounded-lg border border-slate-200 p-3 text-sm text-slate-700 no-underline hover:border-teal-300 hover:bg-teal-50",
                      href: getArtifactHref(artifact, config),
                      target: "_blank",
                      rel: "noreferrer"
                    },
                    React.createElement("div", { className: "flex items-center justify-between gap-2" },
                      React.createElement("span", { className: "font-medium text-slate-900" }, artifact.type),
                      React.createElement("span", { className: "text-xs text-slate-500" }, new Date(artifact.createdAt).toLocaleString())
                    ),
                    React.createElement("div", { className: "mt-1 break-all text-xs text-slate-500" }, artifact.uri)
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
