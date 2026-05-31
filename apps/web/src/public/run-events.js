/* global window, document, fetch, CustomEvent, io */

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

function renderRow(event) {
  const tr = document.createElement("tr");
  tr.setAttribute("data-event-id", event.id);

  const timestamp = new Date(event.timestamp).toLocaleString();
  tr.innerHTML =
    `<td>${timestamp}</td>` +
    `<td>${event.agentId || "-"}</td>` +
    `<td>${event.eventType}</td>` +
    `<td>${event.severity}</td>` +
    `<td>${shortSummary(event)}</td>`;
  return tr;
}

function useRunEvents({ runId, apiBaseUrl, initialEvents }) {
  const state = {
    events: Array.isArray(initialEvents) ? [...initialEvents] : [],
    seenIds: new Set(Array.isArray(initialEvents) ? initialEvents.map((event) => event.id) : [])
  };

  const socket = io(apiBaseUrl, {
    withCredentials: true,
    reconnection: true
  });

  async function fetchHistorical() {
    const response = await fetch(`${apiBaseUrl}/api/runs/${runId}/events`, {
      method: "GET",
      credentials: "include"
    });
    if (!response.ok) return;

    const payload = await response.json();
    const events = Array.isArray(payload.events) ? payload.events : [];
    for (const event of events) {
      if (!state.seenIds.has(event.id)) {
        state.seenIds.add(event.id);
        state.events.push(event);
      }
    }
  }

  function onEvent(event) {
    if (!event || !event.id || state.seenIds.has(event.id)) return;
    state.seenIds.add(event.id);
    state.events.push(event);
    document.dispatchEvent(new CustomEvent("run-event:created", { detail: event }));
  }

  socket.on("connect", () => {
    setStatus("Live feed connected");
    socket.emit("subscribe", { channel: `run:${runId}` });
  });

  socket.on("reconnect", () => {
    setStatus("Live feed reconnected");
    socket.emit("subscribe", { channel: `run:${runId}` });
  });

  socket.on("disconnect", () => {
    setStatus("Live feed disconnected; attempting reconnect");
  });

  socket.on("subscription.error", (error) => {
    const msg = error && error.message ? error.message : "Subscription failed";
    setStatus(`Subscription error: ${msg}`);
  });

  socket.on("event.created", onEvent);

  return {
    state,
    fetchHistorical,
    dispose() {
      socket.off("event.created", onEvent);
      socket.disconnect();
    }
  };
}

function setStatus(text) {
  const el = document.getElementById("socket-status");
  if (el) el.textContent = text;
}

function mount() {
  const config = window.__RUN_EVENTS_CONFIG__;
  if (!config || !config.runId || !config.apiBaseUrl) return;

  const feed = document.getElementById("event-feed");
  if (!feed) return;

  const hook = useRunEvents(config);

  function appendEvent(event) {
    const existing = feed.querySelector(`tr[data-event-id="${event.id}"]`);
    if (existing) return;
    const empty = feed.querySelector("tr td[colspan='5']");
    if (empty && empty.parentElement) empty.parentElement.remove();
    feed.appendChild(renderRow(event));
  }

  for (const event of hook.state.events) {
    appendEvent(event);
  }

  void hook.fetchHistorical().then(() => {
    hook.state.events.forEach((event) => appendEvent(event));
  });

  document.addEventListener("run-event:created", (evt) => appendEvent(evt.detail));
  window.addEventListener("beforeunload", () => hook.dispose(), { once: true });
}

mount();
