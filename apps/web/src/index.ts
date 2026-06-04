import "dotenv/config";
import cookieParser from "cookie-parser";
import express from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
};

type Environment = {
  id: string;
  name: string;
  baseUrl: string;
  type: "LOCAL" | "STAGING" | "DEMO";
  allowedDomains: string[];
  status: "ACTIVE" | "INACTIVE" | "UNREACHABLE";
  createdAt: string;
  updatedAt: string;
};

type Project = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  environments?: Environment[];
};

type SuccessCriteriaItem = { type: "URL_CONTAINS" | "PAGE_CONTAINS_TEXT" | "ELEMENT_VISIBLE" | "EVENT_EMITTED" | "MANUAL_NOTE"; value: string; };

type Workflow = {
  id: string;
  projectId: string;
  name: string;
  description: string;
  goal: string;
  startingPath: string;
  maxSteps: number;
  maxDurationSeconds: number;
  successCriteria: SuccessCriteriaItem[];
  workflowType: "SCRIPTED" | "GOAL_BASED" | "EXPLORATORY";
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
};

type Persona = {
  id: string;
  name: string;
  role: string;
  industry: string;
  technicalProficiency: number;
  domainExpertise: number;
  timePressure: number;
  patience: number;
  confidence: number;
  errorRecovery: number;
  riskTolerance: number;
  accessibilityNeeds: string[];
  behaviorNotes: string;
};

type LlmProviderConfig = {
  id: string;
  provider: "openai" | "anthropic";
  model: string;
  baseUrl: string | null;
  timeoutMs: number | null;
  status: "inactive" | "active" | "error";
  lastCheckedAt: string | null;
  lastError: string | null;
  isActive: boolean;
  hasApiKey: boolean;
};

type SimulationEvent = {
  id: string;
  runId: string;
  agentId: string | null;
  personaId: string | null;
  traceId?: string | null;
  eventType: string;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  payload: Record<string, unknown>;
  timestamp: string;
  createdAt: string;
};

type Artifact = {
  id: string;
  simulationRunId: string;
  simulationAgentId: string;
  type: "SCREENSHOT" | "TRACE" | "VIDEO" | "CONSOLE_LOG" | "NETWORK_LOG" | "REPORT" | "REPORT_PDF";
  uri: string;
  createdAt: string;
};

type Finding = {
  id: string;
  type: string;
  title: string;
  summary: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  recommendation: string;
  createdAt: string;
};

type ActualMetricsImportSummary = {
  id: string;
  sourceLabel: string;
  notes: string;
  rowCount: number;
  createdAt: string;
  periodStart: string;
  periodEnd: string;
  project: { id: string; name: string };
  environment: { id: string; name: string };
  importedByUser: { id: string; name: string; email: string };
};

type CalibrationComparisonRow = {
  workflow: { id: string; name: string };
  actual: {
    taskSuccessRate: number;
    completionTimeMs: number;
    errorRate: number;
    apiCallsPerSession: number;
    supportTicketCount: number;
  };
  synthetic: {
    taskSuccessRate: number;
    completionTimeMs: number;
    errorRate: number;
    apiCallsPerSession: number;
    supportTicketEstimate: number;
    simulationRunId: string | null;
  } | null;
  gaps: {
    taskSuccessRate: number | null;
    completionTimeMs: number | null;
    errorRate: number | null;
    apiCallsPerSession: number | null;
    supportTicketCount: number | null;
  } | null;
};

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  WEB_PORT: z.coerce.number().int().min(1).max(65535),
  API_BASE_URL: z.string().url(),
  AUTH_COOKIE_NAME: z.string().min(1).default("sup_session")
});

const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
  console.error("Invalid WEB environment configuration:");
  for (const issue of parsedEnv.error.issues) {
    console.error(`- ${issue.path.join(".") || "env"}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsedEnv.data;
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use("/static", express.static(path.join(__dirname, "public")));
app.use("/docs-static", express.static(path.resolve(__dirname, "..", "..", "..", "docs")));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

function renderPage(title: string, body: string): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    :root {
      --bg: #f5efe3;
      --card: rgba(255, 255, 255, 0.92);
      --ink: #1f2937;
      --muted: #5f6b7a;
      --line: #d8cdb6;
      --accent: #0f766e;
      --accent-soft: #d5f5ef;
      --warn: #b45309;
      --warn-soft: #ffedd5;
      --danger: #b42318;
      --danger-soft: #fee4e2;
      --shadow: 0 18px 45px rgba(84, 70, 35, 0.12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(15, 118, 110, 0.10), transparent 28%),
        radial-gradient(circle at top right, rgba(180, 83, 9, 0.10), transparent 24%),
        linear-gradient(180deg, #fbf7ef 0%, #f3ebdd 100%);
    }
    a { color: #0f5f73; }
    .page-shell {
      max-width: 1220px;
      margin: 0 auto;
      padding: 28px 16px 56px;
    }
    .hero-card, .surface-card {
      background: var(--card);
      border: 1px solid rgba(216, 205, 182, 0.85);
      box-shadow: var(--shadow);
      border-radius: 24px;
      backdrop-filter: blur(8px);
    }
    .hero-card { padding: 24px; margin-bottom: 22px; }
    .surface-card { padding: 22px; margin-bottom: 18px; }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent);
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-weight: 700;
    }
    .hero-row, .stack-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      flex-wrap: wrap;
    }
    .nav-links {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }
    .nav-links a {
      text-decoration: none;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(15, 118, 110, 0.08);
      color: var(--ink);
    }
    .nav-links a:hover { background: rgba(15, 118, 110, 0.16); }
    .button, button, input, select, textarea {
      font: inherit;
    }
    .button, button {
      border: 0;
      border-radius: 14px;
      background: var(--accent);
      color: white;
      padding: 10px 14px;
      cursor: pointer;
    }
    button.secondary, .button.secondary {
      background: #e7eceb;
      color: var(--ink);
    }
    button.danger, .button.danger {
      background: var(--danger);
    }
    button[disabled] { opacity: 0.7; cursor: progress; }
    input, select, textarea {
      width: 100%;
      padding: 10px 12px;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.95);
      margin-top: 6px;
    }
    textarea { min-height: 100px; }
    label { display: block; font-size: 14px; color: var(--muted); }
    h1, h2, h3 { margin-top: 0; color: #19212b; }
    h1 { font-size: clamp(2rem, 5vw, 3rem); margin-bottom: 10px; }
    h2 { font-size: 1.35rem; margin-bottom: 12px; }
    p.helper, .helper { color: var(--muted); margin-top: 0; }
    .grid-2, .grid-3 {
      display: grid;
      gap: 16px;
    }
    .grid-2 { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
    .grid-3 { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .flash, .error, .empty-state {
      border-radius: 18px;
      padding: 14px 16px;
      margin-bottom: 16px;
    }
    .flash { background: var(--accent-soft); color: var(--accent); border: 1px solid rgba(15, 118, 110, 0.14); }
    .error { background: var(--danger-soft); color: var(--danger); border: 1px solid rgba(180, 35, 24, 0.16); }
    .empty-state { background: #fffaf2; color: var(--muted); border: 1px dashed var(--line); }
    .pill-row { display: flex; flex-wrap: wrap; gap: 10px; }
    .pill {
      display: inline-flex;
      align-items: center;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(15, 118, 110, 0.08);
      color: #24454c;
      font-size: 12px;
      font-weight: 700;
    }
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
    .metric-box {
      padding: 14px;
      border-radius: 18px;
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.8);
    }
    .metric-box strong { display: block; font-size: 1.45rem; margin-top: 8px; }
    .table-shell { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px 8px; border-bottom: 1px solid #ede5d8; vertical-align: top; text-align: left; }
    th { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
    .choice-list label { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border: 1px solid #e9dfcd; border-radius: 14px; background: rgba(255,255,255,0.7); margin-bottom: 8px; color: var(--ink); }
    .choice-list input { width: auto; margin-top: 2px; }
    .page-actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    .inline-form { display: inline; }
    .muted-link { color: var(--muted); }
    [data-loading-form][aria-busy="true"] { opacity: 0.88; }
    @media (max-width: 720px) {
      .page-shell { padding: 18px 12px 48px; }
      .hero-card, .surface-card { padding: 18px; border-radius: 20px; }
    }
  </style>
</head>
<body>
  <div class="page-shell">${body}</div>
  <script>
    document.addEventListener("submit", function (event) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      form.setAttribute("aria-busy", "true");
      const submitters = form.querySelectorAll('button[type="submit"], button:not([type]), input[type="submit"]');
      submitters.forEach(function (button) {
        if (!(button instanceof HTMLButtonElement || button instanceof HTMLInputElement)) return;
        if (!button.hasAttribute("data-original-text")) {
          button.setAttribute("data-original-text", button.textContent || button.value || "");
        }
        const loadingText = button.getAttribute("data-loading-text");
        if (loadingText) {
          if (button instanceof HTMLButtonElement) button.textContent = loadingText;
          if (button instanceof HTMLInputElement) button.value = loadingText;
        }
        button.disabled = true;
      });
    });
  </script>
</body>
</html>`;
}

function esc(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function parseAllowedDomains(value: string): string[] {
  return value.split(",").map((part) => part.trim()).filter(Boolean);
}

function parseStringList(value: string): string[] {
  return value.split(",").map((part) => part.trim()).filter(Boolean);
}

function ensureAuth(user: CurrentUser | null, res: express.Response): user is CurrentUser {
  if (!user) {
    res.redirect("/login");
    return false;
  }
  return true;
}

function personaPreview(persona: Persona): string {
  const technical = persona.technicalProficiency >= 70 ? "high" : persona.technicalProficiency <= 35 ? "low" : "moderate";
  const domain = persona.domainExpertise >= 70 ? "high" : persona.domainExpertise <= 35 ? "low" : "moderate";
  const confidence = persona.confidence >= 70 ? "high" : persona.confidence <= 35 ? "low" : "moderate";
  const patience = persona.patience <= 35 ? "low" : persona.patience >= 70 ? "high" : "moderate";
  const pressure = persona.timePressure >= 70 ? "high" : persona.timePressure <= 35 ? "low" : "moderate";

  const behaviorHints: string[] = [];
  if (technical === "low") behaviorHints.push("avoid hidden menus");
  if (confidence === "low") behaviorHints.push("read labels literally");
  if (patience === "low" || pressure === "high") behaviorHints.push("abandon unclear workflows quickly");
  if (persona.errorRecovery >= 70) behaviorHints.push("try alternative paths after errors");
  if (persona.riskTolerance <= 35) behaviorHints.push("prefer safe and reversible actions");
  if (behaviorHints.length === 0) behaviorHints.push("follow clear primary navigation patterns");

  return `This user has ${domain} ${esc(persona.industry)} domain expertise and ${technical} technical confidence. They are likely to ${behaviorHints.slice(0, 3).join(", ")}.`;
}

async function fetchCurrentUser(cookieHeader: string | undefined): Promise<CurrentUser | null> {
  if (!cookieHeader) return null;
  const response = await fetch(`${env.API_BASE_URL}/auth/me`, { method: "GET", headers: { cookie: cookieHeader } });
  if (!response.ok) return null;
  const payload = (await response.json()) as { user: CurrentUser };
  return payload.user;
}

async function apiRequest<T>(cookieHeader: string | undefined, path: string, init?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<T | null> {
  const response = await fetch(`${env.API_BASE_URL}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), ...(cookieHeader ? { cookie: cookieHeader } : {}) }
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

async function apiRequestDetailed<T>(
  cookieHeader: string | undefined,
  path: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const response = await fetch(`${env.API_BASE_URL}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), ...(cookieHeader ? { cookie: cookieHeader } : {}) }
  });

  if (response.ok) {
    return { ok: true, data: (await response.json()) as T };
  }

  let error = "Request failed";
  try {
    const payload = (await response.json()) as { error?: string };
    if (payload?.error) error = payload.error;
  } catch {
    // ignore parse failure
  }

  return { ok: false, status: response.status, error };
}

function shellNav(user: CurrentUser): string {
  return `<div class="hero-card">
    <div class="hero-row">
      <div>
        <div class="eyebrow">Demo-Ready MVP</div>
        <h1>Synthetic User Dashboard</h1>
        <p class="helper">${esc(user.name)} · ${esc(user.role)} · Org ${esc(user.organizationId)}</p>
      </div>
      <div class="nav-links">
        <a href="/dashboard/projects">Projects</a>
        <a href="/dashboard/personas">Personas</a>
        <a href="/dashboard/test-accounts">Test Accounts</a>
        <a href="/dashboard/workflows">Workflows</a>
        <a href="/dashboard/llm-providers">LLM Providers</a>
        <a href="/dashboard/calibration">Calibration</a>
        <a href="/dashboard/run-setup">Run Setup</a>
        <form method="post" action="/logout" class="inline-form">
          <button type="submit" class="secondary" data-loading-text="Signing out...">Log out</button>
        </form>
      </div>
    </div>
  </div>`;
}

function renderLogin(error?: string): string {
  return renderPage(
    "Platform Login",
    `<div class="hero-card">
      <div class="eyebrow">Synthetic User Validation Platform</div>
      <h1>Dashboard Login</h1>
      <p class="helper">Use the demo operator account to launch runs, watch live activity, and open the generated report.</p>
    </div>
    <div class="surface-card" style="max-width:560px;margin:0 auto;">
      ${error ? `<div class="error">${esc(error)}</div>` : ""}
      <form method="post" action="/login">
        <label>Email<input type="email" name="email" required autocomplete="username" /></label>
        <label style="margin-top:12px;">Password<input type="password" name="password" required autocomplete="current-password" /></label>
        <div class="page-actions" style="margin-top:16px;">
          <button type="submit" data-loading-text="Signing in...">Sign in to dashboard</button>
          <span class="helper">Default demo account is documented in the README.</span>
        </div>
      </form>
    </div>`
  );
}

function renderProjectsPage(user: CurrentUser, projects: Project[], selectedProjectId?: string, flash?: string): string {
  const selectedProject = selectedProjectId ? projects.find((project) => project.id === selectedProjectId) : projects[0];
  const projectsHtml = projects.map((project) => `<li style="border:1px solid #ddd;padding:12px;margin-bottom:10px;"><div style="display:flex;justify-content:space-between;"><strong>${esc(project.name)}</strong><div><a href="/dashboard/projects?projectId=${project.id}">Manage</a> <form method="post" action="/dashboard/projects/${project.id}/delete" style="display:inline;"><button type="submit">Delete</button></form></div></div><form method="post" action="/dashboard/projects/${project.id}/update" style="margin-top:8px;"><input name="name" value="${esc(project.name)}" required /> <button type="submit">Save Name</button></form></li>`).join("\n");
  const environments = selectedProject?.environments ?? [];
  const envRows = environments.map((environment) => `<tr><td>${esc(environment.name)}</td><td>${esc(environment.baseUrl)}</td><td>${esc(environment.type)}</td><td>${esc(environment.allowedDomains.join(", "))}</td><td>${esc(environment.status)}</td><td><form method="post" action="/dashboard/projects/${selectedProject?.id}/environments/${environment.id}/test" style="display:inline;"><button>Test Connection</button></form> <form method="post" action="/dashboard/projects/${selectedProject?.id}/environments/${environment.id}/delete" style="display:inline;"><button>Delete</button></form></td></tr><tr><td colspan="6"><form method="post" action="/dashboard/projects/${selectedProject?.id}/environments/${environment.id}/update" style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr auto;gap:8px;"><input name="name" value="${esc(environment.name)}" required /><input name="baseUrl" value="${esc(environment.baseUrl)}" required /><select name="type"><option ${environment.type === "LOCAL" ? "selected" : ""}>LOCAL</option><option ${environment.type === "STAGING" ? "selected" : ""}>STAGING</option><option ${environment.type === "DEMO" ? "selected" : ""}>DEMO</option></select><input name="allowedDomains" value="${esc(environment.allowedDomains.join(","))}" /><select name="status"><option ${environment.status === "ACTIVE" ? "selected" : ""}>ACTIVE</option><option ${environment.status === "INACTIVE" ? "selected" : ""}>INACTIVE</option><option ${environment.status === "UNREACHABLE" ? "selected" : ""}>UNREACHABLE</option></select><button>Save</button></form></td></tr>`).join("\n");

  return renderPage("Projects", `${shellNav(user)}${flash ? `<p style="color:#0a5;">${esc(flash)}</p>` : ""}<h2>Create Project</h2><form method="post" action="/dashboard/projects"><input name="name" required /> <button>Create</button></form><h2>All Projects</h2><ul style="list-style:none;padding:0;">${projectsHtml || "<li>No projects yet.</li>"}</ul><h2>Environments</h2>${selectedProject ? `<p>Project: <strong>${esc(selectedProject.name)}</strong></p><table style="width:100%;"><thead><tr><th>Name</th><th>Base URL</th><th>Type</th><th>Allowed Domains</th><th>Status</th><th>Actions</th></tr></thead><tbody>${envRows || '<tr><td colspan="6">No environments yet.</td></tr>'}</tbody></table><h3>Add Environment</h3><form method="post" action="/dashboard/projects/${selectedProject.id}/environments" style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr auto;gap:8px;"><input name="name" required /><input name="baseUrl" required /><select name="type"><option>LOCAL</option><option selected>STAGING</option><option>DEMO</option></select><input name="allowedDomains" /><select name="status"><option selected>ACTIVE</option><option>INACTIVE</option><option>UNREACHABLE</option></select><button>Add</button></form>` : "<p>Select a project.</p>"}`);
}

function personaForm(persona?: Persona): string {
  const value = (n?: number) => String(n ?? 50);
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"><label>Name<input name="name" value="${esc(persona?.name ?? "")}" required /></label><label>Role<input name="role" value="${esc(persona?.role ?? "")}" required /></label><label>Industry<input name="industry" value="${esc(persona?.industry ?? "")}" required /></label><label>Accessibility Needs (comma separated)<input name="accessibilityNeeds" value="${esc((persona?.accessibilityNeeds ?? []).join(", "))}" /></label><label style="grid-column:1 / -1;">Behavior Notes<textarea name="behaviorNotes" rows="3">${esc(persona?.behaviorNotes ?? "")}</textarea></label></div>${["technicalProficiency","domainExpertise","timePressure","patience","confidence","errorRecovery","riskTolerance"].map((field) => `<label>${field}<input type="range" min="0" max="100" name="${field}" value="${value(persona?.[field as keyof Persona] as number)}" oninput="this.nextElementSibling.value=this.value" /><output>${value(persona?.[field as keyof Persona] as number)}</output></label>`).join("<br />")}`;
}

function renderPersonasPage(user: CurrentUser, personas: Persona[], selectedPersonaId?: string, flash?: string): string {
  const selected = selectedPersonaId ? personas.find((p) => p.id === selectedPersonaId) : personas[0];
  const list = personas.map((persona) => `<li style="border:1px solid #ddd;padding:12px;margin-bottom:8px;"><div style="display:flex;justify-content:space-between;"><strong>${esc(persona.name)}</strong><div><a href="/dashboard/personas?personaId=${persona.id}">Edit</a> <form method="post" action="/dashboard/personas/${persona.id}/delete" style="display:inline;"><button>Delete</button></form></div></div><small>${esc(persona.role)} · ${esc(persona.industry)}</small><p>${esc(personaPreview(persona))}</p></li>`).join("\n");

  return renderPage("Personas", `${shellNav(user)}${flash ? `<p style="color:#0a5;">${esc(flash)}</p>` : ""}<h2>Create Persona</h2><form method="post" action="/dashboard/personas">${personaForm()}<br /><button type="submit">Create Persona</button></form><h2>Existing Personas</h2><ul style="list-style:none;padding:0;">${list || "<li>No personas yet.</li>"}</ul>${selected ? `<h2>Edit Persona: ${esc(selected.name)}</h2><form method="post" action="/dashboard/personas/${selected.id}/update">${personaForm(selected)}<br /><button type="submit">Save Persona</button></form><h3>Preview</h3><p>${esc(personaPreview(selected))}</p>` : ""}`);
}

function renderRunDetailPage(args: {
  user: CurrentUser;
  runId: string;
  events: SimulationEvent[];
  artifacts: Artifact[];
  findings: Finding[];
  flash?: string;
  error?: string;
}): string {
  const initialEvents = JSON.stringify(args.events);
  const initialArtifacts = JSON.stringify(args.artifacts);
  const initialFindings = JSON.stringify(args.findings);
  return renderPage(
    `Run ${args.runId}`,
    `<script src="https://cdn.tailwindcss.com"></script>
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/recharts/umd/Recharts.min.js"></script>
${shellNav(args.user)}
${args.flash ? `<div class="flash">${esc(args.flash)}</div>` : ""}
${args.error ? `<div class="error">${esc(args.error)}</div>` : ""}
<div class="surface-card">
  <div class="stack-row">
    <div>
      <div class="eyebrow">Live Demo Run</div>
      <h2 style="margin:10px 0 6px;">Run Dashboard: ${esc(args.runId)}</h2>
      <p class="helper">Watch agents execute live, inspect one agent at a time, review findings, and open the generated markdown report.</p>
    </div>
    <div class="page-actions">
      <form method="post" action="/dashboard/runs/${esc(args.runId)}/cancel" onsubmit="return window.confirm('Cancel this run? Active agents will stop after queue cancellation and cleanup.');">
        <button type="submit" class="danger" data-loading-text="Canceling run...">Cancel run</button>
      </form>
      <a class="button secondary" href="/dashboard/run-setup">Start another run</a>
    </div>
  </div>
  <div class="pill-row" style="margin-top:14px;">
    <span class="pill">Live updates</span>
    <span class="pill">Agent drill-down</span>
    <span class="pill">Artifacts + report</span>
  </div>
  <div class="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div class="mb-5 flex items-center justify-between">
      <p id="socket-status" class="text-sm text-slate-500">Connecting live feed...</p>
    </div>
    <div id="run-dashboard-root"></div>
  </div>
</div>
<script src="${env.API_BASE_URL}/socket.io/socket.io.js"></script>
<script>
window.__RUN_EVENTS_CONFIG__ = {
  runId: ${JSON.stringify(args.runId)},
  apiBaseUrl: ${JSON.stringify(env.API_BASE_URL)},
  initialEvents: ${initialEvents},
  initialArtifacts: ${initialArtifacts},
  initialFindings: ${initialFindings}
};
</script>
<script type="module" src="/static/run-events.js"></script>`
  );
}

function renderCalibrationPage(args: {
  user: CurrentUser;
  projects: Project[];
  environments: Environment[];
  workflows: Workflow[];
  selectedProjectId?: string;
  selectedEnvironmentId?: string;
  selectedWorkflowId?: string;
  latestImport: ActualMetricsImportSummary | null;
  comparisonRows: CalibrationComparisonRow[];
  comparisonNote?: string;
  flash?: string;
  error?: string;
  sampleCsv?: string;
}): string {
  const projectOptions = args.projects
    .map((project) => `<option value="${project.id}" ${project.id === args.selectedProjectId ? "selected" : ""}>${esc(project.name)}</option>`)
    .join("");
  const environmentOptions = args.environments
    .map((environment) => `<option value="${environment.id}" ${environment.id === args.selectedEnvironmentId ? "selected" : ""}>${esc(environment.name)}</option>`)
    .join("");
  const workflowOptions = args.workflows
    .map((workflow) => `<option value="${workflow.id}" ${workflow.id === args.selectedWorkflowId ? "selected" : ""}>${esc(workflow.name)}</option>`)
    .join("");

  const importSummary = args.latestImport
    ? `<div class="surface-card">
        <div class="stack-row">
          <div>
            <div class="eyebrow">Latest Actual Import</div>
            <h2 style="margin:10px 0 6px;">${esc(args.latestImport.sourceLabel)}</h2>
            <p class="helper">Imported ${esc(new Date(args.latestImport.createdAt).toLocaleString())} by ${esc(args.latestImport.importedByUser.name)} for ${esc(args.latestImport.project.name)} / ${esc(args.latestImport.environment.name)}.</p>
          </div>
          <div class="metrics-grid" style="min-width:min(100%, 420px);">
            <div class="metric-box"><span>Rows</span><strong>${args.latestImport.rowCount}</strong></div>
            <div class="metric-box"><span>Period Start</span><strong style="font-size:1rem;">${esc(new Date(args.latestImport.periodStart).toLocaleDateString())}</strong></div>
            <div class="metric-box"><span>Period End</span><strong style="font-size:1rem;">${esc(new Date(args.latestImport.periodEnd).toLocaleDateString())}</strong></div>
          </div>
        </div>
        ${args.latestImport.notes ? `<p class="helper" style="margin-top:12px;">${esc(args.latestImport.notes)}</p>` : ""}
      </div>`
    : `<div class="surface-card"><div class="empty-state">No actual metrics have been imported yet. Start with a manual CSV paste to create the first calibration baseline.</div></div>`;

  const rowsHtml = args.comparisonRows
    .map((row) => {
      const synthetic = row.synthetic;
      const gaps = row.gaps;
      const cell = (
        syntheticValue: string,
        actualValue: string,
        gapValue: number | null
      ) =>
        synthetic
          ? `<div><strong>${syntheticValue}</strong> <span class="muted-link">vs</span> ${actualValue}<br /><span class="helper">Gap ${formatGap(gapValue)}</span></div>`
          : `<div><strong>Pending</strong><br /><span class="helper">${actualValue} actual only</span></div>`;

      return `<tr>
        <td><strong>${esc(row.workflow.name)}</strong>${synthetic?.simulationRunId ? `<br /><span class="helper">Run ${esc(synthetic.simulationRunId)}</span>` : ""}</td>
        <td>${cell(formatPercent(synthetic?.taskSuccessRate), formatPercent(row.actual.taskSuccessRate), gaps?.taskSuccessRate ?? null)}</td>
        <td>${cell(formatDurationMs(synthetic?.completionTimeMs), formatDurationMs(row.actual.completionTimeMs), gaps?.completionTimeMs ?? null)}</td>
        <td>${cell(formatPercent(synthetic?.errorRate), formatPercent(row.actual.errorRate), gaps?.errorRate ?? null)}</td>
        <td>${cell(formatNumber(synthetic?.apiCallsPerSession), formatNumber(row.actual.apiCallsPerSession), gaps?.apiCallsPerSession ?? null)}</td>
        <td>${cell(formatInteger(synthetic?.supportTicketEstimate), formatInteger(row.actual.supportTicketCount), gaps?.supportTicketCount ?? null)}</td>
      </tr>`;
    })
    .join("");

  return renderPage(
    "Calibration",
    `${shellNav(args.user)}
    ${args.flash ? `<div class="flash">${esc(args.flash)}</div>` : ""}
    ${args.error ? `<div class="error">${esc(args.error)}</div>` : ""}
    <div class="surface-card">
      <div class="stack-row">
        <div>
          <div class="eyebrow">Phase 26 Foundation</div>
          <h2 style="margin:10px 0 6px;">Synthetic vs Actual Calibration</h2>
          <p class="helper">Use manual CSV imports to compare synthetic predictions against actual beta or production-adjacent workflow metrics while persona accuracy calibration is still internal.</p>
        </div>
        <div class="pill-row">
          <span class="pill">Manual CSV only</span>
          <span class="pill">No Segment/Mixpanel/PostHog yet</span>
          <span class="pill">Gap % visible</span>
        </div>
      </div>
    </div>
    <div class="surface-card">
      <h2>Filters</h2>
      <form method="get" action="/dashboard/calibration" class="grid-3">
        <label>Project<select name="projectId"><option value="">Select project</option>${projectOptions}</select></label>
        <label>Environment<select name="environmentId"><option value="">Select environment</option>${environmentOptions}</select></label>
        <label>Workflow<select name="workflowId"><option value="">All workflows</option>${workflowOptions}</select></label>
        <div class="page-actions" style="grid-column:1 / -1;">
          <button type="submit">Refresh comparison</button>
          <a class="button secondary" href="/dashboard/calibration">Clear filters</a>
        </div>
      </form>
    </div>
    <div class="surface-card">
      <h2>Manual CSV Import</h2>
      <p class="helper">CSV headers: <code>workflow_name,period_start,period_end,task_success_rate,completion_time_ms,error_rate,api_calls_per_session,support_ticket_count</code></p>
      <form method="post" action="/dashboard/calibration/import">
        <input type="hidden" name="projectId" value="${esc(args.selectedProjectId ?? "")}" />
        <input type="hidden" name="environmentId" value="${esc(args.selectedEnvironmentId ?? "")}" />
        <div class="grid-2">
          <label>Source label<input name="sourceLabel" value="Beta weekly import" required /></label>
          <label>Notes<input name="notes" value="Calibration baseline for persona accuracy review" /></label>
        </div>
        <label style="margin-top:12px;">CSV payload<textarea name="csvText" required>${esc(args.sampleCsv ?? "")}</textarea></label>
        <div class="page-actions" style="margin-top:14px;">
          <button type="submit" data-loading-text="Importing metrics...">Import actual metrics</button>
          <a class="button secondary" href="/dashboard/calibration?projectId=${encodeURIComponent(args.selectedProjectId ?? "")}&environmentId=${encodeURIComponent(args.selectedEnvironmentId ?? "")}&sample=1">Load sample CSV</a>
          <a class="muted-link" href="/docs-static/prediction-calibration.md" target="_blank" rel="noreferrer">Calibration docs</a>
        </div>
      </form>
    </div>
    ${importSummary}
    <div class="surface-card">
      <h2>Predicted vs Actual Dashboard</h2>
      <p class="helper">${esc(args.comparisonNote ?? "Use this view to calibrate persona accuracy over time. Synthetic API calls per session and support-ticket estimates are placeholders until telemetry integrations arrive.")}</p>
      <div class="table-shell">
        <table>
          <thead>
            <tr>
              <th>Workflow</th>
              <th>Task Success Rate</th>
              <th>Completion Time</th>
              <th>Error Rate</th>
              <th>API Calls / Session</th>
              <th>Support Tickets</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="6"><div class="empty-state">No comparison rows yet. Import actual metrics for the selected project and environment first.</div></td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`
  );
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number") return "Pending";
  return `${value.toFixed(2)}%`;
}

function formatDurationMs(value: number | null | undefined): string {
  if (typeof value !== "number") return "Pending";
  return `${Math.round(value / 1000)}s`;
}

function formatNumber(value: number | null | undefined): string {
  if (typeof value !== "number") return "Pending";
  return value.toFixed(2);
}

function formatInteger(value: number | null | undefined): string {
  if (typeof value !== "number") return "Pending";
  return String(Math.round(value));
}

function formatGap(value: number | null): string {
  if (value == null) return "n/a";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

app.get("/", async (_req, res) => res.redirect("/dashboard/projects"));
app.get("/dashboard", async (_req, res) => res.redirect("/dashboard/projects"));

app.get("/login", async (req, res) => {
  const user = await fetchCurrentUser(req.headers.cookie);
  if (user) return void res.redirect("/dashboard/projects");
  res.status(200).type("html").send(renderLogin());
});

app.post("/login", async (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const response = await fetch(`${env.API_BASE_URL}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  if (!response.ok) return void res.status(401).type("html").send(renderLogin("Invalid credentials"));
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) res.setHeader("set-cookie", setCookie);
  res.redirect("/dashboard/projects");
});

app.post("/logout", async (req, res) => {
  const response = await fetch(`${env.API_BASE_URL}/auth/logout`, { method: "POST", headers: req.headers.cookie ? { cookie: req.headers.cookie } : undefined });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) res.setHeader("set-cookie", setCookie);
  res.redirect("/login");
});

app.get("/dashboard/projects", async (req, res) => {
  const user = await fetchCurrentUser(req.headers.cookie);
  if (!ensureAuth(user, res)) return;
  const projectsResponse = await apiRequest<{ projects: Project[] }>(req.headers.cookie, "/api/projects");
  const projects = projectsResponse?.projects ?? [];
  const selectedProjectId = typeof req.query.projectId === "string" ? req.query.projectId : projects[0]?.id;
  const flash = typeof req.query.flash === "string" ? req.query.flash : undefined;
  res.status(200).type("html").send(renderProjectsPage(user, projects, selectedProjectId, flash));
});

app.post("/dashboard/projects", async (req, res) => { await apiRequest(req.headers.cookie, "/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: String(req.body.name ?? "") }) }); res.redirect("/dashboard/projects?flash=Project+created"); });
app.post("/dashboard/projects/:projectId/update", async (req, res) => { await apiRequest(req.headers.cookie, `/api/projects/${req.params.projectId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: String(req.body.name ?? "") }) }); res.redirect(`/dashboard/projects?projectId=${req.params.projectId}&flash=Project+updated`); });
app.post("/dashboard/projects/:projectId/delete", async (req, res) => { await apiRequest(req.headers.cookie, `/api/projects/${req.params.projectId}`, { method: "DELETE" }); res.redirect("/dashboard/projects?flash=Project+deleted"); });
app.post("/dashboard/projects/:projectId/environments", async (req, res) => { await apiRequest(req.headers.cookie, `/api/projects/${req.params.projectId}/environments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: String(req.body.name ?? ""), baseUrl: String(req.body.baseUrl ?? ""), type: String(req.body.type ?? "STAGING"), allowedDomains: parseAllowedDomains(String(req.body.allowedDomains ?? "")), status: String(req.body.status ?? "ACTIVE") }) }); res.redirect(`/dashboard/projects?projectId=${req.params.projectId}&flash=Environment+created`); });
app.post("/dashboard/projects/:projectId/environments/:environmentId/update", async (req, res) => { await apiRequest(req.headers.cookie, `/api/projects/${req.params.projectId}/environments/${req.params.environmentId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: String(req.body.name ?? ""), baseUrl: String(req.body.baseUrl ?? ""), type: String(req.body.type ?? "STAGING"), allowedDomains: parseAllowedDomains(String(req.body.allowedDomains ?? "")), status: String(req.body.status ?? "ACTIVE") }) }); res.redirect(`/dashboard/projects?projectId=${req.params.projectId}&flash=Environment+updated`); });
app.post("/dashboard/projects/:projectId/environments/:environmentId/delete", async (req, res) => { await apiRequest(req.headers.cookie, `/api/projects/${req.params.projectId}/environments/${req.params.environmentId}`, { method: "DELETE" }); res.redirect(`/dashboard/projects?projectId=${req.params.projectId}&flash=Environment+deleted`); });
app.post("/dashboard/projects/:projectId/environments/:environmentId/test", async (req, res) => { await apiRequest(req.headers.cookie, `/api/projects/${req.params.projectId}/environments/${req.params.environmentId}/test-connection`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) }); res.redirect(`/dashboard/projects?projectId=${req.params.projectId}&flash=Connection+test+completed`); });

app.get("/dashboard/personas", async (req, res) => {
  const user = await fetchCurrentUser(req.headers.cookie);
  if (!ensureAuth(user, res)) return;
  const personasResponse = await apiRequest<{ personas: Persona[] }>(req.headers.cookie, "/api/personas");
  const personas = personasResponse?.personas ?? [];
  const selectedPersonaId = typeof req.query.personaId === "string" ? req.query.personaId : personas[0]?.id;
  const flash = typeof req.query.flash === "string" ? req.query.flash : undefined;
  res.status(200).type("html").send(renderPersonasPage(user, personas, selectedPersonaId, flash));
});

function personaPayloadFromBody(body: Record<string, unknown>) {
  const num = (k: string) => Number(body[k] ?? 50);
  return {
    name: String(body.name ?? ""),
    role: String(body.role ?? ""),
    industry: String(body.industry ?? ""),
    technicalProficiency: num("technicalProficiency"),
    domainExpertise: num("domainExpertise"),
    timePressure: num("timePressure"),
    patience: num("patience"),
    confidence: num("confidence"),
    errorRecovery: num("errorRecovery"),
    riskTolerance: num("riskTolerance"),
    accessibilityNeeds: parseStringList(String(body.accessibilityNeeds ?? "")),
    behaviorNotes: String(body.behaviorNotes ?? "")
  };
}

app.post("/dashboard/personas", async (req, res) => {
  await apiRequest(req.headers.cookie, "/api/personas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(personaPayloadFromBody(req.body as Record<string, unknown>)) });
  res.redirect("/dashboard/personas?flash=Persona+created");
});

app.post("/dashboard/personas/:personaId/update", async (req, res) => {
  await apiRequest(req.headers.cookie, `/api/personas/${req.params.personaId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(personaPayloadFromBody(req.body as Record<string, unknown>)) });
  res.redirect(`/dashboard/personas?personaId=${req.params.personaId}&flash=Persona+updated`);
});

app.post("/dashboard/personas/:personaId/delete", async (req, res) => {
  await apiRequest(req.headers.cookie, `/api/personas/${req.params.personaId}`, { method: "DELETE" });
  res.redirect("/dashboard/personas?flash=Persona+deleted");
});

app.listen(env.WEB_PORT, () => {
  console.log(`Web listening on http://localhost:${env.WEB_PORT}`);
});


type TestAccount = {
  id: string;
  environmentId: string;
  label: string;
  username: string;
  email: string;
  role: string;
  status: "AVAILABLE" | "RESERVED" | "DISABLED";
  allowConcurrentUse: boolean;
  notes: string;
};

function renderTestAccountsPage(
  user: CurrentUser,
  environments: Environment[],
  accounts: TestAccount[],
  selectedEnvironmentId?: string,
  flash?: string
): string {
  const selectedEnvironment = environments.find((item) => item.id === selectedEnvironmentId) ?? environments[0];

  const accountRows = accounts
    .map(
      (account) => `<tr>
<td>${esc(account.label)}</td>
<td>${esc(account.username)}</td>
<td>${esc(account.email)}</td>
<td>${esc(account.role)}</td>
<td>${esc(account.status)}</td>
<td>${account.allowConcurrentUse ? "yes" : "no"}</td>
<td>
<form method="post" action="/dashboard/test-accounts/${account.id}/reserve" style="display:inline;">
  <input type="hidden" name="environmentId" value="${esc(account.environmentId)}" />
  <input type="hidden" name="runId" value="00000000-0000-0000-0000-000000000001" />
  <input type="hidden" name="agentId" value="00000000-0000-0000-0000-000000000001" />
  <button type="submit">Reserve</button>
</form>
<form method="post" action="/dashboard/test-accounts/${account.id}/release" style="display:inline; margin-left:6px;">
  <input type="hidden" name="environmentId" value="${esc(account.environmentId)}" />
  <input type="hidden" name="runId" value="00000000-0000-0000-0000-000000000001" />
  <input type="hidden" name="agentId" value="00000000-0000-0000-0000-000000000001" />
  <button type="submit">Release</button>
</form>
<form method="post" action="/dashboard/test-accounts/${account.id}/delete" style="display:inline; margin-left:6px;">
  <input type="hidden" name="environmentId" value="${esc(account.environmentId)}" />
  <button type="submit">Delete</button>
</form>
</td></tr>`
    )
    .join("\n");

  return renderPage(
    "Test Accounts",
    `${shellNav(user)}${flash ? `<p style="color:#0a5;">${esc(flash)}</p>` : ""}
<h2>Environment</h2>
<form method="get" action="/dashboard/test-accounts">
<select name="environmentId">${environments
      .map(
        (environment) =>
          `<option value="${esc(environment.id)}" ${selectedEnvironment?.id === environment.id ? "selected" : ""}>${esc(environment.name)} (${esc(environment.baseUrl)})</option>`
      )
      .join("")}</select>
<button type="submit">Load</button>
</form>
${
  selectedEnvironment
    ? `<h2>Create Test Account</h2>
<form method="post" action="/dashboard/test-accounts" style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;">
  <input type="hidden" name="environmentId" value="${esc(selectedEnvironment.id)}" />
  <input name="label" placeholder="Label" required />
  <input name="username" placeholder="Username" required />
  <input name="email" placeholder="Email" required />
  <input name="role" placeholder="Role" required />
  <input name="password" placeholder="Password" required />
  <input name="passwordSecretRef" placeholder="passwordSecretRef (optional)" />
  <select name="status"><option>AVAILABLE</option><option>RESERVED</option><option>DISABLED</option></select>
  <label><input type="checkbox" name="allowConcurrentUse" />Allow concurrent use</label>
  <input name="notes" placeholder="Notes" />
  <button type="submit">Create</button>
</form>
<h3>Import 20 Accounts</h3>
<form method="post" action="/dashboard/test-accounts/import-20">
  <input type="hidden" name="environmentId" value="${esc(selectedEnvironment.id)}" />
  <button type="submit">Generate 20 Accounts</button>
</form>
<h2>Existing Accounts</h2>
<table style="width:100%;"><thead><tr><th>Label</th><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Concurrent</th><th>Actions</th></tr></thead><tbody>${accountRows || '<tr><td colspan="7">No accounts yet.</td></tr>'}</tbody></table>`
    : "<p>No environments available. Create one under Projects first.</p>"
}`
  );
}

app.get("/dashboard/test-accounts", async (req, res) => {
  const user = await fetchCurrentUser(req.headers.cookie);
  if (!ensureAuth(user, res)) return;

  const environmentResponse = await apiRequest<{ projects: Project[] }>(req.headers.cookie, "/api/projects");
  const environments = (environmentResponse?.projects ?? []).flatMap((project) => project.environments ?? []);
  const selectedEnvironmentId =
    typeof req.query.environmentId === "string" ? req.query.environmentId : environments[0]?.id;

  let accounts: TestAccount[] = [];
  if (selectedEnvironmentId) {
    const accountResponse = await apiRequest<{ testAccounts: TestAccount[] }>(
      req.headers.cookie,
      `/api/environments/${selectedEnvironmentId}/test-accounts`
    );
    accounts = accountResponse?.testAccounts ?? [];
  }

  const flash = typeof req.query.flash === "string" ? req.query.flash : undefined;
  res.status(200).type("html").send(renderTestAccountsPage(user, environments, accounts, selectedEnvironmentId, flash));
});

app.post("/dashboard/test-accounts", async (req, res) => {
  const environmentId = String(req.body.environmentId ?? "");

  await apiRequest(req.headers.cookie, `/api/environments/${environmentId}/test-accounts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      environmentId,
      label: String(req.body.label ?? ""),
      username: String(req.body.username ?? ""),
      email: String(req.body.email ?? ""),
      role: String(req.body.role ?? ""),
      plainTextPassword: String(req.body.password ?? ""),
      passwordSecretRef: String(req.body.passwordSecretRef ?? "") || undefined,
      allowConcurrentUse: req.body.allowConcurrentUse === "on",
      status: String(req.body.status ?? "AVAILABLE"),
      notes: String(req.body.notes ?? "")
    })
  });

  res.redirect(`/dashboard/test-accounts?environmentId=${environmentId}&flash=Test+account+created`);
});

app.post("/dashboard/test-accounts/import-20", async (req, res) => {
  const environmentId = String(req.body.environmentId ?? "");

  const accounts = Array.from({ length: 20 }, (_, index) => {
    const n = String(index + 1).padStart(2, "0");
    return {
      label: `Seed Account ${n}`,
      username: `seed_user_${n}`,
      email: `seed_user_${n}@example.local`,
      role: "tester",
      plainTextPassword: `SeedPass!${n}`,
      status: "AVAILABLE",
      allowConcurrentUse: false,
      notes: "Imported batch"
    };
  });

  await apiRequest(req.headers.cookie, `/api/environments/${environmentId}/test-accounts/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accounts })
  });

  res.redirect(`/dashboard/test-accounts?environmentId=${environmentId}&flash=Imported+20+accounts`);
});

app.post("/dashboard/test-accounts/:accountId/delete", async (req, res) => {
  const accountId = req.params.accountId;
  const environmentId = String(req.body.environmentId ?? "");
  await apiRequest(req.headers.cookie, `/api/environments/${environmentId}/test-accounts/${accountId}`, {
    method: "DELETE"
  });
  res.redirect(`/dashboard/test-accounts?environmentId=${environmentId}&flash=Account+deleted`);
});

app.post("/dashboard/test-accounts/:accountId/reserve", async (req, res) => {
  const accountId = req.params.accountId;
  const environmentId = String(req.body.environmentId ?? "");
  await apiRequest(req.headers.cookie, `/api/test-accounts/${accountId}/reserve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ runId: String(req.body.runId), agentId: String(req.body.agentId) })
  });
  res.redirect(`/dashboard/test-accounts?environmentId=${environmentId}&flash=Account+reservation+attempted`);
});

app.post("/dashboard/test-accounts/:accountId/release", async (req, res) => {
  const accountId = req.params.accountId;
  const environmentId = String(req.body.environmentId ?? "");
  await apiRequest(req.headers.cookie, `/api/test-accounts/${accountId}/release`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ runId: String(req.body.runId), agentId: String(req.body.agentId) })
  });
  res.redirect(`/dashboard/test-accounts?environmentId=${environmentId}&flash=Account+release+attempted`);
});


function parseSuccessCriteria(value: string): SuccessCriteriaItem[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawType, ...rest] = line.split(":");
      const type = (rawType?.trim() || "MANUAL_NOTE") as SuccessCriteriaItem["type"];
      const val = rest.join(":").trim() || line;
      return { type, value: val };
    });
}

function successCriteriaToText(items: SuccessCriteriaItem[]): string {
  return items.map((item) => `${item.type}: ${item.value}`).join("\n");
}

function renderWorkflowsPage(
  user: CurrentUser,
  projects: Project[],
  workflows: Workflow[],
  selectedProjectId?: string,
  selectedWorkflowId?: string,
  flash?: string
): string {
  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? projects[0];
  const selectedWorkflow = workflows.find((w) => w.id === selectedWorkflowId) ?? workflows[0];

  const list = workflows
    .map(
      (workflow) => `<li style="border:1px solid #ddd;padding:10px;margin-bottom:8px;">
<strong>${esc(workflow.name)}</strong> (${esc(workflow.workflowType)})<br />
<small>${esc(workflow.goal)}</small>
<div>
  <a href="/dashboard/workflows?projectId=${workflow.projectId}&workflowId=${workflow.id}">Edit</a>
  <form method="post" action="/dashboard/workflows/${workflow.id}/delete" style="display:inline; margin-left:8px;">
    <input type="hidden" name="projectId" value="${esc(workflow.projectId)}" />
    <button type="submit">Delete</button>
  </form>
</div></li>`
    )
    .join("\n");

  return renderPage(
    "Workflows",
    `${shellNav(user)}${flash ? `<p style="color:#0a5;">${esc(flash)}</p>` : ""}
<h2>Select Project</h2>
<form method="get" action="/dashboard/workflows">
<select name="projectId">${projects
      .map((project) => `<option value="${project.id}" ${selectedProject?.id === project.id ? "selected" : ""}>${esc(project.name)}</option>`)
      .join("")}</select>
<button type="submit">Load</button>
</form>
${selectedProject ? `<h2>Create Workflow</h2>
<form method="post" action="/dashboard/workflows" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
<input type="hidden" name="projectId" value="${selectedProject.id}" />
<input name="name" placeholder="Name" required />
<input name="workflowType" placeholder="SCRIPTED|GOAL_BASED|EXPLORATORY" value="GOAL_BASED" required />
<input name="status" placeholder="DRAFT|ACTIVE|ARCHIVED" value="DRAFT" required />
<input name="startingPath" placeholder="/start" required />
<input name="maxSteps" placeholder="100" required />
<input name="maxDurationSeconds" placeholder="600" required />
<input name="goal" placeholder="User completes checkout" required style="grid-column:1/-1;" />
<textarea name="description" placeholder="Description" style="grid-column:1/-1;"></textarea>
<textarea name="successCriteria" placeholder="URL_CONTAINS: /checkout/success\nPAGE_CONTAINS_TEXT: Thank you" style="grid-column:1/-1;height:100px;" required></textarea>
<button type="submit">Create Workflow</button>
</form>
<h2>Workflows</h2>
<ul style="list-style:none;padding:0;">${list || "<li>No workflows yet.</li>"}</ul>` : "<p>Create a project first.</p>"}
${selectedWorkflow ? `<h2>Edit Workflow: ${esc(selectedWorkflow.name)}</h2>
<form method="post" action="/dashboard/workflows/${selectedWorkflow.id}/update" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
<input type="hidden" name="projectId" value="${selectedWorkflow.projectId}" />
<input name="name" value="${esc(selectedWorkflow.name)}" required />
<input name="workflowType" value="${esc(selectedWorkflow.workflowType)}" required />
<input name="status" value="${esc(selectedWorkflow.status)}" required />
<input name="startingPath" value="${esc(selectedWorkflow.startingPath)}" required />
<input name="maxSteps" value="${selectedWorkflow.maxSteps}" required />
<input name="maxDurationSeconds" value="${selectedWorkflow.maxDurationSeconds}" required />
<input name="goal" value="${esc(selectedWorkflow.goal)}" required style="grid-column:1/-1;" />
<textarea name="description" style="grid-column:1/-1;">${esc(selectedWorkflow.description ?? "")}</textarea>
<textarea name="successCriteria" style="grid-column:1/-1;height:100px;" required>${esc(successCriteriaToText(selectedWorkflow.successCriteria || []))}</textarea>
<button type="submit">Save Workflow</button>
</form>` : ""}`
  );
}

app.get("/dashboard/workflows", async (req, res) => {
  const user = await fetchCurrentUser(req.headers.cookie);
  if (!ensureAuth(user, res)) return;

  const projectsResponse = await apiRequest<{ projects: Project[] }>(req.headers.cookie, "/api/projects");
  const projects = projectsResponse?.projects ?? [];
  const selectedProjectId =
    typeof req.query.projectId === "string" ? req.query.projectId : projects[0]?.id;

  let workflows: Workflow[] = [];
  if (selectedProjectId) {
    const workflowResponse = await apiRequest<{ workflows: Workflow[] }>(
      req.headers.cookie,
      `/api/projects/${selectedProjectId}/workflows`
    );
    workflows = workflowResponse?.workflows ?? [];
  }

  const selectedWorkflowId =
    typeof req.query.workflowId === "string" ? req.query.workflowId : workflows[0]?.id;
  const flash = typeof req.query.flash === "string" ? req.query.flash : undefined;

  res
    .status(200)
    .type("html")
    .send(renderWorkflowsPage(user, projects, workflows, selectedProjectId, selectedWorkflowId, flash));
});

function workflowPayloadFromBody(body: Record<string, unknown>) {
  return {
    projectId: String(body.projectId ?? ""),
    name: String(body.name ?? ""),
    description: String(body.description ?? ""),
    goal: String(body.goal ?? ""),
    startingPath: String(body.startingPath ?? ""),
    maxSteps: Number(body.maxSteps ?? 100),
    maxDurationSeconds: Number(body.maxDurationSeconds ?? 600),
    successCriteria: parseSuccessCriteria(String(body.successCriteria ?? "")),
    workflowType: String(body.workflowType ?? "GOAL_BASED"),
    status: String(body.status ?? "DRAFT")
  };
}

app.post("/dashboard/workflows", async (req, res) => {
  const payload = workflowPayloadFromBody(req.body as Record<string, unknown>);
  await apiRequest(req.headers.cookie, `/api/projects/${payload.projectId}/workflows`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  res.redirect(`/dashboard/workflows?projectId=${payload.projectId}&flash=Workflow+created`);
});

app.post("/dashboard/workflows/:workflowId/update", async (req, res) => {
  const workflowId = req.params.workflowId;
  const payload = workflowPayloadFromBody(req.body as Record<string, unknown>);
  await apiRequest(req.headers.cookie, `/api/projects/${payload.projectId}/workflows/${workflowId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  res.redirect(`/dashboard/workflows?projectId=${payload.projectId}&workflowId=${workflowId}&flash=Workflow+updated`);
});

app.post("/dashboard/workflows/:workflowId/delete", async (req, res) => {
  const workflowId = req.params.workflowId;
  const projectId = String(req.body.projectId ?? "");
  await apiRequest(req.headers.cookie, `/api/projects/${projectId}/workflows/${workflowId}`, {
    method: "DELETE"
  });
  res.redirect(`/dashboard/workflows?projectId=${projectId}&flash=Workflow+deleted`);
});

function renderLlmProvidersPage(
  user: CurrentUser,
  configs: LlmProviderConfig[],
  flash?: string,
  error?: string
): string {
  const rows = configs
    .map(
      (config) => `<tr>
<td>${esc(config.provider)}</td>
<td>${esc(config.model)}</td>
<td>${esc(config.baseUrl ?? "-")}</td>
<td>${esc(String(config.timeoutMs ?? 30000))}</td>
<td>${esc(config.status)}</td>
<td>${esc(config.lastCheckedAt ? new Date(config.lastCheckedAt).toLocaleString() : "-")}</td>
<td style="max-width:220px;">${esc(config.lastError ?? "-")}</td>
<td>
  <form method="post" action="/dashboard/llm-providers/${config.id}/test" style="display:inline;">
    <button type="submit">Test Connection</button>
  </form>
</td>
</tr>`
    )
    .join("\n");

  return renderPage(
    "LLM Providers",
    `${shellNav(user)}
${flash ? `<p style="color:#0a5;">${esc(flash)}</p>` : ""}
${error ? `<p style="color:#b00020;">${esc(error)}</p>` : ""}
<h2>Add Provider Configuration</h2>
<form method="post" action="/dashboard/llm-providers" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
  <label>Provider
    <select name="provider">
      <option value="openai">openai</option>
      <option value="anthropic">anthropic</option>
    </select>
  </label>
  <label>Model
    <input name="model" placeholder="gpt-4o-mini or claude-3-5-haiku-latest" required />
  </label>
  <label>API Key
    <input type="password" name="apiKey" required />
  </label>
  <label>Base URL (optional)
    <input name="baseUrl" placeholder="https://api.openai.com/v1" />
  </label>
  <label>Timeout (ms)
    <input name="timeoutMs" type="number" min="1000" max="120000" value="30000" />
  </label>
  <label>Status
    <select name="status">
      <option value="inactive">inactive</option>
      <option value="active">active</option>
      <option value="error">error</option>
    </select>
  </label>
  <button type="submit" style="grid-column:1/-1;">Save Provider</button>
</form>
<h2>Provider Configurations</h2>
<table style="width:100%;"><thead><tr><th>Provider</th><th>Model</th><th>Base URL</th><th>Timeout</th><th>Status</th><th>Last Checked</th><th>Last Error</th><th>Action</th></tr></thead><tbody>${rows || '<tr><td colspan="8">No provider configs yet.</td></tr>'}</tbody></table>`
  );
}

app.get("/dashboard/llm-providers", async (req, res) => {
  const user = await fetchCurrentUser(req.headers.cookie);
  if (!ensureAuth(user, res)) return;

  const response = await apiRequest<{ configs: LlmProviderConfig[] }>(req.headers.cookie, "/api/llm/providers");
  const flash = typeof req.query.flash === "string" ? req.query.flash : undefined;
  const error = typeof req.query.error === "string" ? req.query.error : undefined;

  res.status(200).type("html").send(renderLlmProvidersPage(user, response?.configs ?? [], flash, error));
});

app.post("/dashboard/llm-providers", async (req, res) => {
  const payload = {
    provider: String(req.body.provider ?? "openai"),
    model: String(req.body.model ?? ""),
    apiKey: String(req.body.apiKey ?? ""),
    baseUrl: String(req.body.baseUrl ?? "") || undefined,
    timeoutMs: Number(req.body.timeoutMs ?? 30000),
    status: String(req.body.status ?? "inactive")
  };

  const response = await apiRequest(req.headers.cookie, "/api/llm/providers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response) return void res.redirect("/dashboard/llm-providers?error=Unable+to+save+provider");
  res.redirect("/dashboard/llm-providers?flash=Provider+saved");
});

app.post("/dashboard/llm-providers/:configId/test", async (req, res) => {
  const response = await apiRequest<{ ok: boolean }>(
    req.headers.cookie,
    `/api/llm/providers/${req.params.configId}/test`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) }
  );

  if (!response?.ok) return void res.redirect("/dashboard/llm-providers?error=Provider+test+failed");
  res.redirect("/dashboard/llm-providers?flash=Provider+connection+successful");
});


type BudgetPolicy = {
  id: string;
  name: string;
  maxDurationPerRunSeconds: number | null;
};

type RunSetupOptions = {
  projects: Project[];
  personas: Persona[];
  budgetPolicies: BudgetPolicy[];
};

function personaOptions(personas: Persona[]): string {
  return personas
    .map((persona) => `<label style="display:block;"><input type="checkbox" name="personaIds" value="${persona.id}" /> ${esc(persona.name)} (${esc(persona.role)})</label>`)
    .join("");
}

function testAccountOptions(accounts: TestAccount[]): string {
  return accounts
    .map(
      (account) =>
        `<label style="display:block;"><input type="checkbox" name="testAccountIds" value="${account.id}" /> ${esc(account.label)} (${esc(account.status)})</label>`
    )
    .join("");
}

function renderRunSetupPage(args: {
  user: CurrentUser;
  options: RunSetupOptions;
  selectedProjectId?: string;
  selectedEnvironmentId?: string;
  selectedWorkflowId?: string;
  workflows: Workflow[];
  testAccounts: TestAccount[];
  error?: string;
  flash?: string;
}): string {
  const selectedProject =
    args.options.projects.find((project) => project.id === args.selectedProjectId) ?? args.options.projects[0];
  const environments = selectedProject?.environments ?? [];
  const activeWorkflows = args.workflows.filter((workflow) => workflow.status === "ACTIVE");
  const availableAccounts = args.testAccounts.filter((account) => account.status !== "DISABLED");
  const hasSetupPrereqs =
    args.options.projects.length > 0 &&
    environments.length > 0 &&
    activeWorkflows.length > 0 &&
    args.options.personas.length > 0 &&
    availableAccounts.length > 0 &&
    args.options.budgetPolicies.length > 0;

  return renderPage(
    "Run Setup",
    `${shellNav(args.user)}
${args.error ? `<div class="error">${esc(args.error)}</div>` : ""}
${args.flash ? `<div class="flash">${esc(args.flash)}</div>` : ""}
<div class="surface-card">
  <div class="stack-row">
    <div>
      <div class="eyebrow">Demo Launch Flow</div>
      <h2 style="margin:10px 0 6px;">Simulation Run Setup</h2>
      <p class="helper">Choose the project, environment, and workflow you want to showcase, then either use the 20-agent demo preset or launch a custom run.</p>
    </div>
    <div class="metrics-grid" style="min-width:min(100%, 430px);">
      <div class="metric-box"><span class="helper">Projects</span><strong>${args.options.projects.length}</strong></div>
      <div class="metric-box"><span class="helper">Active workflows</span><strong>${activeWorkflows.length}</strong></div>
      <div class="metric-box"><span class="helper">Available accounts</span><strong>${availableAccounts.length}</strong></div>
      <div class="metric-box"><span class="helper">Personas</span><strong>${args.options.personas.length}</strong></div>
    </div>
  </div>
</div>
<div class="grid-2">
  <div class="surface-card">
    <h2>1. Choose Project and Environment</h2>
    <p class="helper">These filters only refresh available workflows and test accounts. They do not start a run.</p>
    <form method="get" action="/dashboard/run-setup" class="grid-2">
      <label>Project
        <select name="projectId" required onchange="this.form.submit()">
        ${args.options.projects
          .map(
            (project) =>
              `<option value="${project.id}" ${selectedProject?.id === project.id ? "selected" : ""}>${esc(project.name)}</option>`
          )
          .join("")}
        </select>
      </label>
      <label>Environment
        <select name="environmentId" required onchange="this.form.submit()">
        ${environments
          .map(
            (environment) =>
              `<option value="${environment.id}" ${args.selectedEnvironmentId === environment.id ? "selected" : ""}>${esc(environment.name)} · ${esc(environment.type)}</option>`
          )
          .join("")}
        </select>
      </label>
      <noscript><button type="submit">Refresh options</button></noscript>
    </form>
    ${
      args.options.projects.length === 0
        ? `<div class="empty-state">No projects found yet. Create a project first, then add an environment before starting a run.</div>`
        : ""
    }
    ${
      selectedProject && environments.length === 0
        ? `<div class="empty-state">Project <strong>${esc(selectedProject.name)}</strong> has no environments yet. Add one from the Projects screen to continue.</div>`
        : ""
    }
  </div>
  <div class="surface-card">
    <h2>2. 20-Agent Demo Preset</h2>
    <p class="helper">Fastest path for the live walkthrough. This preset picks the configured demo project, environment, workflow, personas, and accounts automatically.</p>
    <div class="pill-row" style="margin-bottom:14px;">
      <span class="pill">20 agents</span>
      <span class="pill">live dashboard</span>
      <span class="pill">report included</span>
    </div>
    <form method="post" action="/dashboard/demo-runs/20-agent">
      <input type="hidden" name="projectId" value="${esc(selectedProject?.id ?? "")}" />
      <input type="hidden" name="environmentId" value="${esc(args.selectedEnvironmentId ?? "")}" />
      <input type="hidden" name="workflowId" value="${esc(args.selectedWorkflowId ?? activeWorkflows[0]?.id ?? "")}" />
      <button type="submit" data-loading-text="Starting demo run...">Start 20-agent demo preset</button>
    </form>
  </div>
</div>
<div class="surface-card">
  <h2>3. Custom Run</h2>
  ${
    hasSetupPrereqs
      ? `<form method="post" action="/dashboard/run-setup/preview" class="grid-2">
        <input type="hidden" name="projectId" value="${esc(selectedProject?.id ?? "")}" />
        <input type="hidden" name="environmentId" value="${esc(args.selectedEnvironmentId ?? "")}" />
        <label>Workflow
          <select name="workflowId" required>${activeWorkflows
            .map(
              (workflow) =>
                `<option value="${workflow.id}" ${args.selectedWorkflowId === workflow.id ? "selected" : ""}>${esc(workflow.name)} (${esc(workflow.status)})</option>`
            )
            .join("")}</select>
        </label>
        <label>Budget Policy
          <select name="budgetPolicyId" required>
            ${args.options.budgetPolicies.map((policy) => `<option value="${policy.id}">${esc(policy.name)}</option>`).join("")}
          </select>
        </label>
        <label>Number of Agents
          <input type="number" min="1" max="100" name="agentCount" value="${Math.min(availableAccounts.length, 5)}" required />
        </label>
        <label>Max Run Duration (seconds)
          <input type="number" min="30" max="7200" name="maxRunDurationSeconds" value="600" required />
        </label>
        <div>
          <h3>Personas</h3>
          <p class="helper">Select one or more personas to distribute across agents.</p>
          <div class="choice-list">${personaOptions(args.options.personas)}</div>
        </div>
        <div>
          <h3>Test Accounts</h3>
          <p class="helper">Only non-disabled accounts from the selected environment are shown.</p>
          <div class="choice-list">${testAccountOptions(availableAccounts)}</div>
        </div>
        <div class="page-actions" style="grid-column:1/-1;">
          <button type="submit" data-loading-text="Preparing summary...">Review run summary</button>
        </div>
      </form>`
      : `<div class="empty-state">
          The run launcher is waiting on setup data.
          <div style="margin-top:10px;">
            ${
              args.options.projects.length === 0 ? `<div>Need at least one project.</div>` : ``
            }
            ${
              environments.length === 0 ? `<div>Need at least one environment in the selected project.</div>` : ``
            }
            ${
              activeWorkflows.length === 0 ? `<div>Need at least one ACTIVE workflow for the selected project.</div>` : ``
            }
            ${
              args.options.personas.length === 0 ? `<div>Need at least one persona.</div>` : ``
            }
            ${
              availableAccounts.length === 0 ? `<div>Need at least one non-disabled test account in the selected environment.</div>` : ``
            }
            ${
              args.options.budgetPolicies.length === 0 ? `<div>Need at least one active budget policy.</div>` : ``
            }
          </div>
        </div>`
  }
</div>`
  );
}

function parseMulti(body: Record<string, unknown>, key: string): string[] {
  const value = body[key];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return [value];
  return [];
}

app.get("/dashboard/run-setup", async (req, res) => {
  const user = await fetchCurrentUser(req.headers.cookie);
  if (!ensureAuth(user, res)) return;

  const options = await apiRequest<RunSetupOptions>(req.headers.cookie, "/api/run-setup/options");
  if (!options) {
    return void res.status(500).type("html").send(renderPage("Error", "Unable to load run setup options."));
  }

  const selectedProjectId =
    typeof req.query.projectId === "string" ? req.query.projectId : options.projects[0]?.id;
  const selectedProject = options.projects.find((project) => project.id === selectedProjectId);
  const selectedEnvironmentId =
    typeof req.query.environmentId === "string"
      ? req.query.environmentId
      : selectedProject?.environments?.[0]?.id;

  const workflowsResponse = selectedProjectId
    ? await apiRequest<{ workflows: Workflow[] }>(
        req.headers.cookie,
        `/api/projects/${selectedProjectId}/workflows`
      )
    : { workflows: [] as Workflow[] };
  const workflows = workflowsResponse?.workflows ?? [];
  const selectedWorkflowId =
    typeof req.query.workflowId === "string"
      ? req.query.workflowId
      : workflows.find((workflow) => workflow.status === "ACTIVE")?.id ?? workflows[0]?.id;

  const testAccountsResponse = selectedEnvironmentId
    ? await apiRequest<{ testAccounts: TestAccount[] }>(
        req.headers.cookie,
        `/api/environments/${selectedEnvironmentId}/test-accounts`
      )
    : { testAccounts: [] as TestAccount[] };

  const flash = typeof req.query.flash === "string" ? req.query.flash : undefined;
  const error = typeof req.query.error === "string" ? req.query.error : undefined;

  res
    .status(200)
    .type("html")
    .send(
      renderRunSetupPage({
        user,
        options,
        selectedProjectId,
        selectedEnvironmentId,
        selectedWorkflowId,
        workflows,
        testAccounts: testAccountsResponse?.testAccounts ?? [],
        error,
        flash
      })
    );
});

app.post("/dashboard/run-setup/preview", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const payload = {
    projectId: String(body.projectId ?? ""),
    environmentId: String(body.environmentId ?? ""),
    workflowId: String(body.workflowId ?? ""),
    personaIds: parseMulti(body, "personaIds"),
    agentCount: Number(body.agentCount ?? 0),
    testAccountIds: parseMulti(body, "testAccountIds"),
    budgetPolicyId: String(body.budgetPolicyId ?? ""),
    maxRunDurationSeconds: Number(body.maxRunDurationSeconds ?? 0)
  };

  const user = await fetchCurrentUser(req.headers.cookie);
  if (!ensureAuth(user, res)) return;

  res.status(200).type("html").send(
    renderPage(
      "Run Summary",
      `${shellNav(user)}
<div class="surface-card">
  <div class="eyebrow">Preflight Review</div>
  <h2 style="margin:10px 0 8px;">Run Summary</h2>
  <p class="helper">Confirm the selection below before creating the run.</p>
  <div class="table-shell">
    <table>
      <tbody>
        <tr><th>Project</th><td>${esc(payload.projectId)}</td></tr>
        <tr><th>Environment</th><td>${esc(payload.environmentId)}</td></tr>
        <tr><th>Workflow</th><td>${esc(payload.workflowId)}</td></tr>
        <tr><th>Agent count</th><td>${esc(String(payload.agentCount))}</td></tr>
        <tr><th>Budget policy</th><td>${esc(payload.budgetPolicyId)}</td></tr>
        <tr><th>Max duration</th><td>${esc(String(payload.maxRunDurationSeconds))} seconds</td></tr>
        <tr><th>Persona IDs</th><td>${payload.personaIds.length > 0 ? esc(payload.personaIds.join(", ")) : "None selected"}</td></tr>
        <tr><th>Test account IDs</th><td>${payload.testAccountIds.length > 0 ? esc(payload.testAccountIds.join(", ")) : "None selected"}</td></tr>
      </tbody>
    </table>
  </div>
  <form method="post" action="/dashboard/run-setup/start" style="margin-top:16px;">
${Object.entries(payload)
  .map(([key, value]) => {
    if (Array.isArray(value)) {
      return value.map((v) => `<input type="hidden" name="${key}" value="${esc(String(v))}" />`).join("");
    }
    return `<input type="hidden" name="${key}" value="${esc(String(value))}" />`;
  })
  .join("")}
    <div class="page-actions">
      <button type="submit" data-loading-text="Creating run...">Start run</button>
      <a class="button secondary" href="/dashboard/run-setup?projectId=${encodeURIComponent(payload.projectId)}&environmentId=${encodeURIComponent(payload.environmentId)}">Back to setup</a>
    </div>
  </form>
</div>`
    )
  );
});

app.post("/dashboard/run-setup/start", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const payload = {
    projectId: String(body.projectId ?? ""),
    environmentId: String(body.environmentId ?? ""),
    workflowId: String(body.workflowId ?? ""),
    personaIds: parseMulti(body, "personaIds"),
    agentCount: Number(body.agentCount ?? 0),
    testAccountIds: parseMulti(body, "testAccountIds"),
    budgetPolicyId: String(body.budgetPolicyId ?? ""),
    maxRunDurationSeconds: Number(body.maxRunDurationSeconds ?? 0)
  };

  const response = await apiRequestDetailed<{ run?: { id: string } }>(req.headers.cookie, "/api/simulation-runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok || !response.data?.run?.id) {
    const error = response.ok ? "Run configuration is invalid" : response.error;
    return void res.redirect(`/dashboard/run-setup?error=${encodeURIComponent(error)}`);
  }

  res.redirect(`/dashboard/runs/${response.data.run.id}?flash=Pending+run+created`);
});

app.post("/dashboard/demo-runs/20-agent", async (req, res) => {
  const payload = {
    projectId: String(req.body.projectId ?? "") || undefined,
    environmentId: String(req.body.environmentId ?? "") || undefined,
    workflowId: String(req.body.workflowId ?? "") || undefined
  };

  const response = await apiRequestDetailed<{ run?: { id: string } }>(req.headers.cookie, "/api/demo-runs/20-agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok || !response.data?.run?.id) {
    const error = response.ok ? "Unable to start 20-agent demo run" : response.error;
    return void res.redirect(`/dashboard/run-setup?error=${encodeURIComponent(error)}`);
  }

  res.redirect(`/dashboard/runs/${response.data.run.id}?flash=20-agent+demo+run+started`);
});

app.get("/dashboard/calibration", async (req, res) => {
  const user = await fetchCurrentUser(req.headers.cookie);
  if (!ensureAuth(user, res)) return;

  const projectsResponse = await apiRequest<{ projects: Project[] }>(req.headers.cookie, "/api/projects");
  const projects = projectsResponse?.projects ?? [];
  const selectedProjectId = typeof req.query.projectId === "string" ? req.query.projectId : projects[0]?.id;
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0];
  const environments = selectedProject?.environments ?? [];
  const selectedEnvironmentId =
    typeof req.query.environmentId === "string" ? req.query.environmentId : environments[0]?.id;
  const selectedEnvironment = environments.find((environment) => environment.id === selectedEnvironmentId) ?? environments[0];
  const workflowsResponse =
    selectedProject?.id
      ? await apiRequest<{ workflows: Workflow[] }>(
          req.headers.cookie,
          `/api/projects/${selectedProject.id}/workflows`
        )
      : null;
  const workflows = workflowsResponse?.workflows ?? [];
  const selectedWorkflowId = typeof req.query.workflowId === "string" ? req.query.workflowId : undefined;

  const comparisonParams = new URLSearchParams();
  if (selectedProject?.id) comparisonParams.set("projectId", selectedProject.id);
  if (selectedEnvironment?.id) comparisonParams.set("environmentId", selectedEnvironment.id);
  if (selectedWorkflowId) comparisonParams.set("workflowId", selectedWorkflowId);

  const comparisonsResponse =
    selectedProject?.id && selectedEnvironment?.id
      ? await apiRequest<{
          import: ActualMetricsImportSummary | null;
          rows: CalibrationComparisonRow[];
          note?: string;
        }>(req.headers.cookie, `/api/actual-metrics/comparisons?${comparisonParams.toString()}`)
      : null;

  let sampleCsv = "";
  if (req.query.sample === "1") {
    try {
      sampleCsv = await readFile(path.resolve(__dirname, "..", "..", "..", "docs", "sample-actual-workflow-metrics.csv"), "utf8");
    } catch {
      sampleCsv = "";
    }
  }

  const flash = typeof req.query.flash === "string" ? req.query.flash : undefined;
  const error = typeof req.query.error === "string" ? req.query.error : undefined;
  res.status(200).type("html").send(
    renderCalibrationPage({
      user,
      projects,
      environments,
      workflows,
      selectedProjectId: selectedProject?.id,
      selectedEnvironmentId: selectedEnvironment?.id,
      selectedWorkflowId,
      latestImport: comparisonsResponse?.import ?? null,
      comparisonRows: comparisonsResponse?.rows ?? [],
      comparisonNote: comparisonsResponse?.note,
      flash,
      error,
      sampleCsv
    })
  );
});

app.post("/dashboard/calibration/import", async (req, res) => {
  const payload = {
    projectId: String(req.body.projectId ?? ""),
    environmentId: String(req.body.environmentId ?? ""),
    sourceLabel: String(req.body.sourceLabel ?? ""),
    notes: String(req.body.notes ?? ""),
    csvText: String(req.body.csvText ?? "")
  };

  if (!payload.projectId || !payload.environmentId) {
    return void res.redirect("/dashboard/calibration?error=Select+a+project+and+environment+before+importing");
  }

  const response = await apiRequestDetailed<{ import?: { id: string } }>(req.headers.cookie, "/api/actual-metrics/import-csv", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const query = new URLSearchParams({
    projectId: payload.projectId,
    environmentId: payload.environmentId
  });

  if (!response.ok) {
    query.set("error", response.error);
    return void res.redirect(`/dashboard/calibration?${query.toString()}`);
  }

  query.set("flash", "Actual metrics imported");
  res.redirect(`/dashboard/calibration?${query.toString()}`);
});

app.get("/dashboard/runs/:runId", async (req, res) => {
  const user = await fetchCurrentUser(req.headers.cookie);
  if (!ensureAuth(user, res)) return;

  const runId = req.params.runId;
  const eventsResponse = await apiRequest<{ events: SimulationEvent[] }>(
    req.headers.cookie,
    `/api/runs/${runId}/events`
  );
  const artifactsResponse = await apiRequest<{ artifacts: Artifact[] }>(
    req.headers.cookie,
    `/api/runs/${runId}/artifacts`
  );
  const findingsResponse = await apiRequest<{ findings: Finding[] }>(
    req.headers.cookie,
    `/api/runs/${runId}/findings`
  );

  if (!eventsResponse || !artifactsResponse) {
    return void res
      .status(404)
      .type("html")
      .send(renderPage("Run Not Found", `${shellNav(user)}<div class="error">Run not found or inaccessible.</div>`));
  }

  const flash = typeof req.query.flash === "string" ? req.query.flash : undefined;
  const error = typeof req.query.error === "string" ? req.query.error : undefined;
  res.status(200).type("html").send(
    renderRunDetailPage({
      user,
      runId,
      events: eventsResponse.events,
      artifacts: artifactsResponse.artifacts,
      findings: findingsResponse?.findings ?? [],
      flash,
      error
    })
  );
});

app.post("/dashboard/runs/:runId/cancel", async (req, res) => {
  const response = await apiRequestDetailed<{ success: boolean }>(
    req.headers.cookie,
    `/api/simulation-runs/${req.params.runId}/cancel`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) }
  );

  if (!response.ok || !response.data.success) {
    const error = response.ok ? "Unable to cancel run" : response.error;
    return void res.redirect(`/dashboard/runs/${req.params.runId}?error=${encodeURIComponent(error)}`);
  }

  res.redirect(`/dashboard/runs/${req.params.runId}?flash=Run+cancel+requested`);
});

app.get("/runs/:runId", async (req, res) => {
  const flash = typeof req.query.flash === "string" ? req.query.flash : "";
  const encodedFlash = flash ? `?flash=${encodeURIComponent(flash)}` : "";
  res.redirect(`/dashboard/runs/${req.params.runId}${encodedFlash}`);
});


