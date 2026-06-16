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
      --bg: #010403;
      --bg-top: #03110a;
      --card: rgba(3, 12, 8, 0.78);
      --card-strong: rgba(4, 16, 10, 0.9);
      --card-soft: rgba(3, 14, 9, 0.58);
      --ink: #effff5;
      --muted: #91ad9d;
      --line: rgba(57, 255, 136, 0.14);
      --line-strong: rgba(94, 255, 150, 0.28);
      --accent: #39ff88;
      --accent-soft: rgba(57, 255, 136, 0.12);
      --accent-2: #65b7ff;
      --accent-3: #00d46a;
      --success: #60ff9f;
      --warning: #f2d15b;
      --danger: #ff5f77;
      --shadow: 0 18px 48px rgba(0, 0, 0, 0.42);
      --glow: 0 0 0 1px rgba(57, 255, 136, 0.08), 0 0 28px rgba(57, 255, 136, 0.09);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Aptos", "Segoe UI Variable", "Bahnschrift", sans-serif;
      color: var(--ink);
      background:
        linear-gradient(180deg, #03110a 0%, #010403 52%, #000201 100%),
        repeating-linear-gradient(90deg, rgba(57,255,136,0.035) 0 1px, transparent 1px 58px);
      min-height: 100vh;
    }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      background:
        repeating-linear-gradient(180deg, rgba(57,255,136,0.052) 0 1px, transparent 1px 10px),
        linear-gradient(90deg, transparent 0 8%, rgba(57,255,136,0.045) 8.1% 8.3%, transparent 8.4% 100%);
      background-size: 100% 10px, 180px 100%;
      opacity: 0.7;
      mask-image: linear-gradient(180deg, rgba(0,0,0,0.52), transparent 92%);
    }
    a { color: #9dffbf; }
    .page-shell {
      max-width: 1380px;
      margin: 0 auto;
      padding: 26px 18px 64px;
    }
    .hero-card, .surface-card {
      position: relative;
      background: linear-gradient(180deg, rgba(4, 16, 10, 0.84) 0%, rgba(1, 8, 5, 0.9) 100%);
      border: 1px solid var(--line);
      box-shadow: var(--shadow), var(--glow);
      border-radius: 8px;
      backdrop-filter: blur(12px);
      overflow: hidden;
    }
    .hero-card::after, .surface-card::after {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: linear-gradient(135deg, rgba(57, 255, 136, 0.035), transparent 38%, transparent 76%, rgba(101, 183, 255, 0.035));
    }
    .hero-card { padding: 28px; margin-bottom: 22px; }
    .surface-card { padding: 24px; margin-bottom: 18px; }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 12px;
      border-radius: 4px;
      background: rgba(57, 255, 136, 0.08);
      color: var(--accent);
      font-size: 12px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      font-weight: 700;
      border: 1px solid rgba(57, 255, 136, 0.16);
      box-shadow: inset 0 0 16px rgba(57, 255, 136, 0.05);
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
      padding: 10px 14px;
      border-radius: 4px;
      background: rgba(57, 255, 136, 0.035);
      color: #cfffe0;
      border: 1px solid rgba(57, 255, 136, 0.13);
      transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
    }
    .nav-links a:hover {
      background: rgba(57, 255, 136, 0.1);
      border-color: rgba(57, 255, 136, 0.34);
      transform: translateY(-1px);
    }
    .button, button, input, select, textarea {
      font: inherit;
    }
    .button, button {
      border: 0;
      border-radius: 4px;
      background: linear-gradient(135deg, #39ff88 0%, #00b85c 100%);
      color: #001f0f;
      padding: 10px 16px;
      cursor: pointer;
      font-weight: 700;
      letter-spacing: 0.01em;
      box-shadow: 0 10px 24px rgba(0, 184, 92, 0.24);
      transition: transform 180ms ease, box-shadow 180ms ease, opacity 180ms ease;
    }
    .button:hover, button:hover { transform: translateY(-1px); box-shadow: 0 14px 28px rgba(0, 184, 92, 0.32); }
    button.secondary, .button.secondary {
      background: rgba(57, 255, 136, 0.04);
      color: var(--ink);
      border: 1px solid rgba(57, 255, 136, 0.18);
      box-shadow: none;
    }
    button.danger, .button.danger {
      background: linear-gradient(135deg, #ff7182 0%, #ff8c6a 100%);
      color: #19090d;
    }
    button[disabled] { opacity: 0.7; cursor: progress; }
    input, select, textarea {
      width: 100%;
      padding: 12px 14px;
      border-radius: 4px;
      border: 1px solid var(--line);
      background: rgba(0, 6, 3, 0.82);
      color: var(--ink);
      margin-top: 6px;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.01);
    }
    input::placeholder, textarea::placeholder { color: #587865; }
    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: rgba(57, 255, 136, 0.5);
      box-shadow: 0 0 0 3px rgba(57, 255, 136, 0.13);
    }
    textarea { min-height: 100px; }
    label { display: block; font-size: 13px; color: var(--muted); letter-spacing: 0.02em; }
    h1, h2, h3 {
      margin-top: 0;
      color: #f1fff6;
      font-family: "Aptos Display", "Segoe UI Variable", "Trebuchet MS", sans-serif;
    }
    h1 {
      font-size: 3.8rem;
      line-height: 0.96;
      margin-bottom: 12px;
      letter-spacing: 0;
    }
    h2 { font-size: 1.45rem; margin-bottom: 12px; letter-spacing: 0; }
    h3 { font-size: 1rem; letter-spacing: 0; }
    p.helper, .helper { color: var(--muted); margin-top: 0; }
    .grid-2, .grid-3 {
      display: grid;
      gap: 16px;
    }
    .grid-2 { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
    .grid-3 { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .grid-4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; }
    .flash, .error, .empty-state {
      border-radius: 6px;
      padding: 14px 16px;
      margin-bottom: 16px;
    }
    .flash { background: rgba(57, 255, 136, 0.08); color: var(--accent); border: 1px solid rgba(57, 255, 136, 0.2); }
    .error { background: rgba(255, 107, 134, 0.1); color: #ffc1cc; border: 1px solid rgba(255, 107, 134, 0.2); }
    .empty-state { background: rgba(57,255,136,0.035); color: var(--muted); border: 1px dashed rgba(57, 255, 136, 0.24); }
    .pill-row { display: flex; flex-wrap: wrap; gap: 10px; }
    .pill {
      display: inline-flex;
      align-items: center;
      padding: 6px 10px;
      border-radius: 4px;
      background: rgba(57, 255, 136, 0.075);
      color: #baffce;
      font-size: 12px;
      font-weight: 700;
      border: 1px solid rgba(57, 255, 136, 0.16);
    }
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
    .metric-box {
      padding: 16px;
      border-radius: 6px;
      border: 1px solid rgba(57, 255, 136, 0.14);
      background: linear-gradient(180deg, rgba(6, 24, 14, 0.86) 0%, rgba(2, 10, 6, 0.92) 100%);
      min-height: 112px;
    }
    .metric-box strong { display: block; font-size: 1.8rem; margin-top: 12px; letter-spacing: -0.01em; }
    .metric-box .helper { margin-bottom: 0; }
    .table-shell { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px 10px; border-bottom: 1px solid rgba(57, 255, 136, 0.12); vertical-align: top; text-align: left; }
    th { color: #6dff9c; font-size: 11px; text-transform: uppercase; letter-spacing: 0.18em; }
    .choice-list label { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border: 1px solid rgba(57, 255, 136, 0.15); border-radius: 6px; background: rgba(57,255,136,0.035); margin-bottom: 8px; color: var(--ink); }
    .choice-list input { width: auto; margin-top: 2px; }
    .page-actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    .inline-form { display: inline; }
    .muted-link { color: var(--muted); }
    [data-loading-form][aria-busy="true"] { opacity: 0.88; }
    .panel-grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 18px; align-items: start; }
    .panel-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
    .section-kicker {
      display: inline-block;
      margin-bottom: 10px;
      color: #6dff9c;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.22em;
      text-transform: uppercase;
    }
    .stack-list {
      display: grid;
      gap: 12px;
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .list-item {
      padding: 16px;
      border-radius: 6px;
      background: rgba(57,255,136,0.035);
      border: 1px solid rgba(57, 255, 136, 0.14);
    }
    .list-item strong { font-size: 1rem; }
    .list-meta { color: var(--muted); font-size: 13px; margin-top: 6px; }
    .action-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
      margin-top: 14px;
    }
    .mini-tag {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border-radius: 4px;
      padding: 5px 10px;
      background: rgba(57,255,136,0.045);
      border: 1px solid rgba(57, 255, 136, 0.12);
      color: #d8ffe2;
      font-size: 12px;
    }
    .status {
      display: inline-flex;
      align-items: center;
      border-radius: 4px;
      padding: 5px 10px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      border: 1px solid transparent;
    }
    .status.active { color: var(--success); background: rgba(88, 255, 148, 0.1); border-color: rgba(88, 255, 148, 0.2); }
    .status.warning { color: #ffd38d; background: rgba(255, 182, 73, 0.12); border-color: rgba(255, 182, 73, 0.2); }
    .status.danger { color: #ffc0cb; background: rgba(255, 107, 134, 0.12); border-color: rgba(255, 107, 134, 0.2); }
    .status.info { color: #c9ffd7; background: rgba(57, 255, 136, 0.1); border-color: rgba(57, 255, 136, 0.2); }
    .dial-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 14px;
      margin-top: 18px;
    }
    .dial-card {
      padding: 16px 14px;
      border-radius: 6px;
      border: 1px solid rgba(57, 255, 136, 0.14);
      background: linear-gradient(180deg, rgba(6, 22, 13, 0.9) 0%, rgba(2, 9, 5, 0.95) 100%);
      text-align: center;
      min-height: 194px;
    }
    .dial-ring {
      width: 92px;
      height: 92px;
      margin: 0 auto 14px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background:
        radial-gradient(circle at center, rgba(2, 9, 5, 1) 58%, transparent 59%),
        conic-gradient(var(--dial-color, var(--accent)) 0 var(--progress, 72%), rgba(255,255,255,0.08) var(--progress, 72%) 100%);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.03), 0 0 18px color-mix(in srgb, var(--dial-color, var(--accent)) 22%, transparent);
    }
    .dial-ring span {
      font-size: 1.45rem;
      font-weight: 800;
      letter-spacing: -0.01em;
    }
    .dial-card strong {
      display: block;
      margin-bottom: 6px;
      font-size: 0.98rem;
    }
    .dial-card p {
      margin: 0;
      font-size: 12px;
      color: var(--muted);
    }
    .hero-title-line {
      display: flex;
      align-items: baseline;
      gap: 10px;
      flex-wrap: wrap;
    }
    .hero-accent {
      color: var(--accent);
      text-shadow: 0 0 18px rgba(57, 255, 136, 0.28);
    }
    .toolbar-note {
      min-width: 220px;
      padding: 14px 16px;
      border-radius: 6px;
      background: rgba(57,255,136,0.035);
      border: 1px solid rgba(57, 255, 136, 0.13);
    }
    .toolbar-note strong {
      display: block;
      font-size: 1.2rem;
      margin-top: 8px;
    }
    code {
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(57,255,136,0.08);
      color: #caffd8;
    }
    .nexus-shell {
      position: relative;
      min-height: 520px;
      display: grid;
      grid-template-columns: minmax(320px, 0.82fr) minmax(420px, 1.18fr);
      gap: 20px;
      align-items: stretch;
      padding: 20px;
      margin-bottom: 20px;
      border: 1px solid rgba(57, 255, 136, 0.16);
      border-radius: 8px;
      background:
        linear-gradient(180deg, rgba(4, 16, 10, 0.72), rgba(1, 6, 4, 0.92)),
        repeating-linear-gradient(90deg, rgba(57,255,136,0.03) 0 1px, transparent 1px 84px);
      box-shadow: var(--shadow), 0 0 44px rgba(57, 255, 136, 0.08);
      overflow: hidden;
    }
    .nexus-shell::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        linear-gradient(90deg, transparent 0 24%, rgba(57,255,136,0.05) 24.2% 24.4%, transparent 24.6% 100%),
        repeating-linear-gradient(180deg, transparent 0 28px, rgba(57,255,136,0.045) 29px 30px);
      opacity: 0.52;
    }
    .nexus-copy, .nexus-stage {
      position: relative;
      z-index: 1;
    }
    .nexus-copy {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 22px;
      min-width: 0;
    }
    .nexus-title {
      font-size: 4.15rem;
      line-height: 0.92;
      margin: 8px 0 14px;
      letter-spacing: 0;
    }
    .nexus-title span {
      color: var(--accent);
      text-shadow: 0 0 20px rgba(57, 255, 136, 0.24);
    }
    .nexus-subcopy {
      max-width: 540px;
      color: #a9c2b3;
      font-size: 1rem;
      line-height: 1.55;
    }
    .nexus-stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .nexus-stat {
      min-height: 94px;
      padding: 14px;
      border: 1px solid rgba(57, 255, 136, 0.14);
      border-radius: 6px;
      background: rgba(0, 8, 5, 0.48);
    }
    .nexus-stat strong {
      display: block;
      margin-top: 8px;
      color: #f0fff5;
      font-size: 1.55rem;
      letter-spacing: 0;
    }
    .nexus-stage {
      min-height: 480px;
      border: 1px solid rgba(57, 255, 136, 0.11);
      border-radius: 8px;
      background:
        linear-gradient(180deg, rgba(0, 10, 6, 0.24), rgba(0, 3, 2, 0.64)),
        repeating-linear-gradient(0deg, transparent 0 34px, rgba(57,255,136,0.035) 35px 36px);
      overflow: hidden;
    }
    .nexus-scene {
      width: 100%;
      height: 100%;
      min-height: 480px;
      cursor: grab;
      touch-action: none;
    }
    .nexus-scene:active { cursor: grabbing; }
    .nexus-scene canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
    .nexus-strip {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }
    .nexus-nav {
      margin-top: 18px;
      padding-top: 18px;
      border-top: 1px solid rgba(57, 255, 136, 0.12);
    }
    .nexus-nav .nav-links a {
      background: transparent;
      border-color: rgba(57, 255, 136, 0.11);
    }
    @media (prefers-reduced-motion: reduce) {
      body::before, .nexus-shell::before { opacity: 0.28; }
      .button, button, .nav-links a { transition: none; }
    }
    @media (max-width: 720px) {
      .page-shell { padding: 18px 12px 48px; }
      .hero-card, .surface-card { padding: 18px; border-radius: 8px; }
      h1, .nexus-title { font-size: 2.55rem; }
      .nexus-stats { grid-template-columns: 1fr; }
      .nexus-shell { padding: 12px; }
      .nexus-stage, .nexus-scene { min-height: 360px; }
    }
    @media (max-width: 980px) {
      .panel-grid { grid-template-columns: 1fr; }
      .nexus-shell { grid-template-columns: 1fr; }
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
  <script type="module" src="/static/nexus-scene.js"></script>
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

function percent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

function statusClass(status: string): "active" | "warning" | "danger" | "info" {
  const normalized = status.toUpperCase();
  if (normalized === "ACTIVE" || normalized === "AVAILABLE" || normalized === "COMPLETED") return "active";
  if (normalized === "INACTIVE" || normalized === "WARNING" || normalized === "RESERVED" || normalized === "DRAFT") return "warning";
  if (normalized === "FAILED" || normalized === "DISABLED" || normalized === "CRITICAL" || normalized === "UNREACHABLE") return "danger";
  return "info";
}

function renderStatusBadge(status: string): string {
  return `<span class="status ${statusClass(status)}">${esc(status)}</span>`;
}

function renderDialCard(label: string, value: number, tone: string, sublabel: string): string {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  return `<div class="dial-card" style="--dial-color:${tone};--progress:${safeValue}%;">
    <div class="dial-ring"><span>${safeValue}%</span></div>
    <strong>${esc(label)}</strong>
    <p>${esc(sublabel)}</p>
  </div>`;
}

function renderMetricBox(label: string, value: string | number, detail: string): string {
  return `<div class="metric-box"><span class="helper">${esc(label)}</span><strong>${esc(String(value))}</strong><p class="helper">${esc(detail)}</p></div>`;
}

function shellNav(user: CurrentUser): string {
  return `<section class="nexus-shell" aria-labelledby="nexus-title">
    <div class="nexus-copy">
      <div>
        <div class="eyebrow">Nexus View · Live graph</div>
        <h1 id="nexus-title" class="nexus-title">Nexus <span>View</span></h1>
        <p class="nexus-subcopy">${esc(user.name)} is connected as ${esc(user.role)}. Personas, accounts, workflows, and active runs appear as one living validation network.</p>
        <div class="nexus-strip">
          <span class="pill">consumer-clean</span>
          <span class="pill">network-native</span>
          <span class="pill">release signal</span>
        </div>
      </div>
      <div class="nexus-stats" aria-label="Network summary">
        <div class="nexus-stat"><span class="section-kicker">Connected</span><strong data-nexus-connected-value>128</strong><span class="helper">people and test identities</span></div>
        <div class="nexus-stat"><span class="section-kicker">Live Now</span><strong data-nexus-live-value>0</strong><span class="helper">agents currently moving</span></div>
        <div class="nexus-stat"><span class="section-kicker">Signals</span><strong data-nexus-signal-value>0</strong><span class="helper">events in the active run</span></div>
      </div>
      <div class="nexus-nav">
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
    </div>
    <div class="nexus-stage">
      <div class="nexus-scene" data-nexus-scene data-connected="128" data-live="0" role="img"></div>
    </div>
  </section>`;
}

function renderLogin(error?: string): string {
  return renderPage(
    "Platform Login",
    `<section class="nexus-shell" aria-labelledby="login-nexus-title">
      <div class="nexus-copy">
        <div>
          <div class="eyebrow">Synthetic User Platform</div>
          <h1 id="login-nexus-title" class="nexus-title">Nexus <span>Access</span></h1>
          <p class="nexus-subcopy">A living validation graph for synthetic beta testers, workflow evidence, and release confidence.</p>
        </div>
        <div class="nexus-stats">
          <div class="nexus-stat"><span class="section-kicker">Readiness</span><strong>82%</strong><span class="helper">operator access</span></div>
          <div class="nexus-stat"><span class="section-kicker">Scope</span><strong>87%</strong><span class="helper">network guardrails</span></div>
          <div class="nexus-stat"><span class="section-kicker">Evidence</span><strong>91%</strong><span class="helper">reports and artifacts</span></div>
        </div>
      </div>
      <div class="nexus-stage">
        <div class="nexus-scene" data-nexus-scene data-connected="96" data-live="12" role="img"></div>
      </div>
    </section>
    <div class="surface-card" style="max-width:560px;margin:0 auto;">
      <span class="section-kicker">Operator Access</span>
      <h2>Dashboard Login</h2>
      <p class="helper">Sign in with the seeded platform owner account. This is separate from the app user you want to test.</p>
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
  const allEnvironments = projects.flatMap((project) => project.environments ?? []);
  const activeEnvironmentCount = allEnvironments.filter((environment) => environment.status === "ACTIVE").length;
  const localEnvironmentCount = allEnvironments.filter((environment) => /localhost|127\.0\.0\.1/i.test(environment.baseUrl)).length;
  const attachedProjectCount = projects.filter((project) => (project.environments ?? []).length > 0).length;
  const readyEnvironmentCount = allEnvironments.filter(
    (environment) => environment.status === "ACTIVE" && /localhost|127\.0\.0\.1/i.test(environment.baseUrl)
  ).length;
  const projectsHtml = projects
    .map(
      (project) => `<li class="list-item">
        <div class="panel-title">
          <div>
            <strong>${esc(project.name)}</strong>
            <div class="list-meta">${(project.environments ?? []).length} environment${(project.environments ?? []).length === 1 ? "" : "s"}</div>
          </div>
          <div class="action-row" style="margin-top:0;">
            <a class="button secondary" href="/dashboard/projects?projectId=${project.id}">Manage</a>
            <form method="post" action="/dashboard/projects/${project.id}/delete" class="inline-form">
              <button type="submit" class="danger">Delete</button>
            </form>
          </div>
        </div>
        <form method="post" action="/dashboard/projects/${project.id}/update" class="grid-2" style="margin-top:10px;">
          <label>Project name<input name="name" value="${esc(project.name)}" required /></label>
          <div class="page-actions" style="align-self:end;">
            <button type="submit">Save Name</button>
          </div>
        </form>
      </li>`
    )
    .join("\n");
  const environments = selectedProject?.environments ?? [];
  const envRows = environments
    .map(
      (environment) => `<tr>
        <td><strong>${esc(environment.name)}</strong></td>
        <td><code>${esc(environment.baseUrl)}</code></td>
        <td>${renderStatusBadge(environment.type)}</td>
        <td>${environment.allowedDomains.length > 0 ? environment.allowedDomains.map((domain) => `<span class="mini-tag">${esc(domain)}</span>`).join(" ") : '<span class="helper">No allowlist</span>'}</td>
        <td>${renderStatusBadge(environment.status)}</td>
        <td>
          <div class="action-row" style="margin-top:0;">
            <form method="post" action="/dashboard/projects/${selectedProject?.id}/environments/${environment.id}/test" class="inline-form"><button>Test Connection</button></form>
            <form method="post" action="/dashboard/projects/${selectedProject?.id}/environments/${environment.id}/delete" class="inline-form"><button class="danger">Delete</button></form>
          </div>
        </td>
      </tr>
      <tr>
        <td colspan="6">
          <form method="post" action="/dashboard/projects/${selectedProject?.id}/environments/${environment.id}/update" class="grid-3" style="margin-top:8px;">
            <label>Name<input name="name" value="${esc(environment.name)}" required /></label>
            <label>Base URL<input name="baseUrl" value="${esc(environment.baseUrl)}" required /></label>
            <label>Type<select name="type"><option ${environment.type === "LOCAL" ? "selected" : ""}>LOCAL</option><option ${environment.type === "STAGING" ? "selected" : ""}>STAGING</option><option ${environment.type === "DEMO" ? "selected" : ""}>DEMO</option></select></label>
            <label>Allowed Domains<input name="allowedDomains" value="${esc(environment.allowedDomains.join(","))}" /></label>
            <label>Status<select name="status"><option ${environment.status === "ACTIVE" ? "selected" : ""}>ACTIVE</option><option ${environment.status === "INACTIVE" ? "selected" : ""}>INACTIVE</option><option ${environment.status === "UNREACHABLE" ? "selected" : ""}>UNREACHABLE</option></select></label>
            <div class="page-actions" style="align-self:end;">
              <button>Save</button>
            </div>
          </form>
        </td>
      </tr>`
    )
    .join("\n");

  return renderPage(
    "Projects",
    `${shellNav(user)}
${flash ? `<div class="flash">${esc(flash)}</div>` : ""}
<div class="surface-card">
  <div class="panel-title">
    <div>
      <span class="section-kicker">Control Layer</span>
      <h2>Project and target environment control</h2>
      <p class="helper">Aim the synthetic users at the right local app, keep allowed domains tight, and make sure each target is clearly marked before you run anything.</p>
    </div>
    <div class="pill-row">
      <span class="pill">${projects.length} project${projects.length === 1 ? "" : "s"}</span>
      <span class="pill">${allEnvironments.length} target${allEnvironments.length === 1 ? "" : "s"}</span>
      <span class="pill">${readyEnvironmentCount} local-ready</span>
    </div>
  </div>
  <div class="dial-grid">
    ${renderDialCard("Project coverage", percent(attachedProjectCount, Math.max(projects.length, 1)), "#39ff88", "projects wired to targets")}
    ${renderDialCard("Active targets", percent(activeEnvironmentCount, Math.max(allEnvironments.length, 1)), "#58ff94", "environments marked active")}
    ${renderDialCard("Local routing", percent(localEnvironmentCount, Math.max(allEnvironments.length, 1)), "#a8ff60", "localhost or 127.0.0.1")}
    ${renderDialCard("Ready signal", percent(readyEnvironmentCount, Math.max(allEnvironments.length, 1)), "#ffb649", "active and local")}
  </div>
</div>
<div class="panel-grid">
  <div class="surface-card">
    <div class="panel-title">
      <div>
        <span class="section-kicker">Project List</span>
        <h2>Projects</h2>
      </div>
    </div>
    <form method="post" action="/dashboard/projects" class="grid-2" style="margin-bottom:18px;">
      <label>Create project<input name="name" placeholder="Borrower Portal QA" required /></label>
      <div class="page-actions" style="align-self:end;">
        <button>Create</button>
      </div>
    </form>
    <ul class="stack-list">${projectsHtml || '<li class="list-item"><span class="helper">No projects yet.</span></li>'}</ul>
  </div>
  <div class="surface-card">
    <div class="panel-title">
      <div>
        <span class="section-kicker">Environment Matrix</span>
        <h2>${selectedProject ? `Targets for ${esc(selectedProject.name)}` : "Environment targets"}</h2>
      </div>
      ${selectedProject ? renderMetricBox("Selected project", selectedProject.name, `${environments.length} environment${environments.length === 1 ? "" : "s"}`) : ""}
    </div>
    ${
      selectedProject
        ? `<div class="table-shell">
            <table>
              <thead><tr><th>Name</th><th>Base URL</th><th>Type</th><th>Allowed Domains</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>${envRows || '<tr><td colspan="6"><div class="empty-state">No environments yet for this project.</div></td></tr>'}</tbody>
            </table>
          </div>
          <div style="margin-top:18px;">
            <span class="section-kicker">Add Environment</span>
            <form method="post" action="/dashboard/projects/${selectedProject.id}/environments" class="grid-3">
              <label>Name<input name="name" placeholder="local-vite-app" required /></label>
              <label>Base URL<input name="baseUrl" placeholder="http://localhost:5173" required /></label>
              <label>Type<select name="type"><option>LOCAL</option><option selected>STAGING</option><option>DEMO</option></select></label>
              <label>Allowed Domains<input name="allowedDomains" placeholder="localhost,127.0.0.1" /></label>
              <label>Status<select name="status"><option selected>ACTIVE</option><option>INACTIVE</option><option>UNREACHABLE</option></select></label>
              <div class="page-actions" style="align-self:end;">
                <button>Add Environment</button>
              </div>
            </form>
          </div>`
        : `<div class="empty-state">Select or create a project first. Then we can point it at your localhost app.</div>`
    }
  </div>
</div>`
  );
}

function personaForm(persona?: Persona): string {
  const value = (n?: number) => String(n ?? 50);
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"><label>Name<input name="name" value="${esc(persona?.name ?? "")}" required /></label><label>Role<input name="role" value="${esc(persona?.role ?? "")}" required /></label><label>Industry<input name="industry" value="${esc(persona?.industry ?? "")}" required /></label><label>Accessibility Needs (comma separated)<input name="accessibilityNeeds" value="${esc((persona?.accessibilityNeeds ?? []).join(", "))}" /></label><label style="grid-column:1 / -1;">Behavior Notes<textarea name="behaviorNotes" rows="3">${esc(persona?.behaviorNotes ?? "")}</textarea></label></div>${["technicalProficiency","domainExpertise","timePressure","patience","confidence","errorRecovery","riskTolerance"].map((field) => `<label>${field}<input type="range" min="0" max="100" name="${field}" value="${value(persona?.[field as keyof Persona] as number)}" oninput="this.nextElementSibling.value=this.value" /><output>${value(persona?.[field as keyof Persona] as number)}</output></label>`).join("<br />")}`;
}

function renderPersonasPage(user: CurrentUser, personas: Persona[], selectedPersonaId?: string, flash?: string): string {
  const selected = selectedPersonaId ? personas.find((p) => p.id === selectedPersonaId) : personas[0];
  const list = personas
    .map(
      (persona) => `<li class="list-item">
        <div class="panel-title">
          <div>
            <strong>${esc(persona.name)}</strong>
            <div class="list-meta">${esc(persona.role)} · ${esc(persona.industry)}</div>
          </div>
          <div class="action-row" style="margin-top:0;">
            <a class="button secondary" href="/dashboard/personas?personaId=${persona.id}">Edit</a>
            <form method="post" action="/dashboard/personas/${persona.id}/delete" class="inline-form"><button class="danger">Delete</button></form>
          </div>
        </div>
        <p class="helper" style="margin-bottom:0;">${esc(personaPreview(persona))}</p>
      </li>`
    )
    .join("\n");

  return renderPage(
    "Personas",
    `${shellNav(user)}
${flash ? `<div class="flash">${esc(flash)}</div>` : ""}
<div class="surface-card">
  <span class="section-kicker">Behavior Model</span>
  <h2>Personas</h2>
  <p class="helper">These are the synthetic people who make the platform behave differently under pressure, uncertainty, and time limits.</p>
</div>
<div class="panel-grid">
  <div class="surface-card">
    <span class="section-kicker">Create Persona</span>
    <h2>New persona</h2>
    <form method="post" action="/dashboard/personas" class="grid-2">${personaForm()}<div class="page-actions" style="grid-column:1/-1;"><button type="submit">Create Persona</button></div></form>
  </div>
  <div class="surface-card">
    <span class="section-kicker">Preview</span>
    <h2>${selected ? esc(selected.name) : "Persona preview"}</h2>
    ${selected ? `<p class="helper">${esc(personaPreview(selected))}</p>` : `<div class="empty-state">Select a persona to preview behavior.</div>`}
  </div>
</div>
<div class="surface-card">
  <span class="section-kicker">Existing Personas</span>
  <h2>Library</h2>
  <ul class="stack-list">${list || '<li class="list-item"><span class="helper">No personas yet.</span></li>'}</ul>
  ${selected ? `<div style="margin-top:20px;"><span class="section-kicker">Edit Persona</span><h2>${esc(selected.name)}</h2><form method="post" action="/dashboard/personas/${selected.id}/update" class="grid-2">${personaForm(selected)}<div class="page-actions" style="grid-column:1/-1;"><button type="submit">Save Persona</button></div></form></div>` : ""}
</div>`
  );
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
<script src="https://unpkg.com/prop-types@15.8.1/prop-types.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/recharts@2.12.7/umd/Recharts.min.js"></script>
<style>
  #run-dashboard-root [class*="bg-white"],
  #run-dashboard-root [class*="bg-slate-50"] {
    background-color: rgba(3, 14, 8, 0.94) !important;
  }
  #run-dashboard-root [class*="bg-emerald-50"],
  #run-dashboard-root [class*="bg-teal-50"],
  #run-dashboard-root [class*="bg-amber-50"] {
    background-color: rgba(57, 255, 136, 0.09) !important;
  }
  #run-dashboard-root [class*="bg-rose-50"] {
    background-color: rgba(255, 95, 119, 0.1) !important;
  }
  #run-dashboard-root [class*="bg-slate-100"] {
    background-color: rgba(57, 255, 136, 0.1) !important;
  }
  #run-dashboard-root [class*="border-slate"],
  #run-dashboard-root [class*="border-emerald"],
  #run-dashboard-root [class*="border-teal"] {
    border-color: rgba(57, 255, 136, 0.18) !important;
  }
  #run-dashboard-root [class*="text-slate-900"],
  #run-dashboard-root [class*="text-slate-800"],
  #run-dashboard-root [class*="text-slate-700"],
  #run-dashboard-root [class*="text-emerald-900"],
  #run-dashboard-root [class*="text-emerald-800"] {
    color: #e9fff3 !important;
  }
  #run-dashboard-root [class*="text-slate-600"],
  #run-dashboard-root [class*="text-slate-500"] {
    color: #86a996 !important;
  }
  #run-dashboard-root [class*="text-teal-700"],
  #run-dashboard-root [class*="hover:text-teal-700"]:hover {
    color: #39ff88 !important;
  }
  #run-dashboard-root [class*="bg-emerald-700"] {
    background-color: #00b85c !important;
    color: #001f0f !important;
  }
  #run-dashboard-root .recharts-cartesian-grid line {
    stroke: rgba(57, 255, 136, 0.12);
  }
  #run-dashboard-root .recharts-text {
    fill: #86a996;
  }
</style>
${shellNav(args.user)}
${args.flash ? `<div class="flash">${esc(args.flash)}</div>` : ""}
${args.error ? `<div class="error">${esc(args.error)}</div>` : ""}
<div class="surface-card">
  <div class="panel-title">
    <div>
      <span class="section-kicker">Live Monitoring</span>
      <h2>Run Dashboard: ${esc(args.runId)}</h2>
      <p class="helper">Watch agents execute live, inspect one agent at a time, review findings, and open the generated markdown report.</p>
    </div>
    <div class="page-actions">
      <form method="post" action="/dashboard/runs/${esc(args.runId)}/cancel" onsubmit="return window.confirm('Cancel this run? Active agents will stop after queue cancellation and cleanup.');">
        <button type="submit" class="danger" data-loading-text="Canceling run...">Cancel run</button>
      </form>
      <a class="button secondary" href="/dashboard/run-setup">Start another run</a>
    </div>
  </div>
  <div class="pill-row">
    <span class="pill">Live updates</span>
    <span class="pill">Agent drill-down</span>
    <span class="pill">Artifacts + report</span>
  </div>
  <div class="dial-grid">
    ${renderDialCard("Actions", 78, "#39ff88", "total interactions")}
    ${renderDialCard("Active", 64, "#a8ff60", "agents in motion")}
    ${renderDialCard("Findings", 52, "#ffb649", "issues surfaced")}
    ${renderDialCard("Frustration", 38, "#ff6b86", "current stress")}
  </div>
  <div style="margin-top:18px;" class="surface-card">
    <div class="panel-title">
      <p id="socket-status" class="helper" style="margin:0;">Connecting live feed...</p>
      <span class="mini-tag">realtime stream</span>
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
  <div class="panel-title">
    <div>
      <span class="section-kicker">Calibration Loop</span>
      <h2>Synthetic vs Actual Calibration</h2>
      <p class="helper">Use manual CSV imports to compare synthetic predictions against actual beta or production-adjacent workflow metrics while persona accuracy calibration is still internal.</p>
    </div>
    <div class="pill-row">
      <span class="pill">Manual CSV only</span>
      <span class="pill">No Segment/Mixpanel/PostHog yet</span>
      <span class="pill">Gap % visible</span>
    </div>
  </div>
</div>
<div class="panel-grid">
  <div class="surface-card">
    <span class="section-kicker">Filters</span>
    <h2>Choose scope</h2>
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
    <span class="section-kicker">Import</span>
    <h2>Manual CSV</h2>
    <p class="helper">CSV headers: <code>workflow_name,period_start,period_end,task_success_rate,completion_time_ms,error_rate,api_calls_per_session,support_ticket_count</code></p>
    <form method="post" action="/dashboard/calibration/import" class="grid-2">
      <input type="hidden" name="projectId" value="${esc(args.selectedProjectId ?? "")}" />
      <input type="hidden" name="environmentId" value="${esc(args.selectedEnvironmentId ?? "")}" />
      <label>Source label<input name="sourceLabel" value="Beta weekly import" required /></label>
      <label>Notes<input name="notes" value="Calibration baseline for persona accuracy review" /></label>
      <label style="grid-column:1/-1;">CSV payload<textarea name="csvText" required>${esc(args.sampleCsv ?? "")}</textarea></label>
      <div class="page-actions" style="grid-column:1/-1;">
        <button type="submit" data-loading-text="Importing metrics...">Import actual metrics</button>
        <a class="button secondary" href="/dashboard/calibration?projectId=${encodeURIComponent(args.selectedProjectId ?? "")}&environmentId=${encodeURIComponent(args.selectedEnvironmentId ?? "")}&sample=1">Load sample CSV</a>
        <a class="muted-link" href="/docs-static/prediction-calibration.md" target="_blank" rel="noreferrer">Calibration docs</a>
      </div>
    </form>
  </div>
</div>
${importSummary}
<div class="surface-card">
  <span class="section-kicker">Comparison</span>
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
  const availableCount = accounts.filter((account) => account.status === "AVAILABLE").length;
  const reservedCount = accounts.filter((account) => account.status === "RESERVED").length;
  const disabledCount = accounts.filter((account) => account.status === "DISABLED").length;
  const concurrentCount = accounts.filter((account) => account.allowConcurrentUse).length;

  const accountRows = accounts
    .map(
      (account) => `<tr>
<td><strong>${esc(account.label)}</strong></td>
<td>${esc(account.username)}</td>
<td>${esc(account.email)}</td>
<td>${esc(account.role)}</td>
<td>${renderStatusBadge(account.status)}</td>
<td>${account.allowConcurrentUse ? '<span class="mini-tag">shared</span>' : '<span class="helper">single use</span>'}</td>
<td>
<div class="action-row" style="margin-top:0;">
<form method="post" action="/dashboard/test-accounts/${account.id}/reserve" class="inline-form">
  <input type="hidden" name="environmentId" value="${esc(account.environmentId)}" />
  <input type="hidden" name="runId" value="00000000-0000-0000-0000-000000000001" />
  <input type="hidden" name="agentId" value="00000000-0000-0000-0000-000000000001" />
  <button type="submit">Reserve</button>
</form>
<form method="post" action="/dashboard/test-accounts/${account.id}/release" class="inline-form">
  <input type="hidden" name="environmentId" value="${esc(account.environmentId)}" />
  <input type="hidden" name="runId" value="00000000-0000-0000-0000-000000000001" />
  <input type="hidden" name="agentId" value="00000000-0000-0000-0000-000000000001" />
  <button type="submit" class="secondary">Release</button>
</form>
<form method="post" action="/dashboard/test-accounts/${account.id}/delete" class="inline-form">
  <input type="hidden" name="environmentId" value="${esc(account.environmentId)}" />
  <button type="submit" class="danger">Delete</button>
</form></div>
</td></tr>`
    )
    .join("\n");

  const environmentPicker = `<form method="get" action="/dashboard/test-accounts" class="grid-2">
      <label>Environment<select name="environmentId">${environments
        .map(
          (environment) =>
            `<option value="${esc(environment.id)}" ${selectedEnvironment?.id === environment.id ? "selected" : ""}>${esc(environment.name)} (${esc(environment.baseUrl)})</option>`
        )
        .join("")}</select></label>
      <div class="page-actions" style="align-self:end;"><button type="submit">Load</button></div>
    </form>`;

  const accountForm = selectedEnvironment
    ? `<div style="margin-top:18px;">
        <span class="section-kicker">Single Account</span>
        <h2>Create test account</h2>
        <form method="post" action="/dashboard/test-accounts" class="grid-3">
          <input type="hidden" name="environmentId" value="${esc(selectedEnvironment.id)}" />
          <label>Label<input name="label" placeholder="Tom Riddle" required /></label>
          <label>Username<input name="username" placeholder="triddle1999@gmail.com" required /></label>
          <label>Email<input name="email" placeholder="triddle1999@gmail.com" required /></label>
          <label>Role<input name="role" placeholder="tester" required /></label>
          <label>Password<input name="password" placeholder="Qwertyasd123!!" required /></label>
          <label>passwordSecretRef<input name="passwordSecretRef" placeholder="optional" /></label>
          <label>Status<select name="status"><option>AVAILABLE</option><option>RESERVED</option><option>DISABLED</option></select></label>
          <label>Notes<input name="notes" placeholder="local borrower portal test login" /></label>
          <label style="display:flex;align-items:center;gap:10px;margin-top:28px;"><input type="checkbox" name="allowConcurrentUse" style="width:auto;margin-top:0;" />Allow concurrent use</label>
          <div class="page-actions" style="align-self:end;"><button type="submit">Create</button></div>
        </form>
        <div style="margin-top:18px;">
          <span class="section-kicker">Batch Import</span>
          <h3>Generate 20 placeholder accounts</h3>
          <form method="post" action="/dashboard/test-accounts/import-20" class="page-actions">
            <input type="hidden" name="environmentId" value="${esc(selectedEnvironment.id)}" />
            <button type="submit">Generate 20 Accounts</button>
          </form>
        </div>
      </div>`
    : `<div class="empty-state" style="margin-top:18px;">No environments available. Create one under Projects first.</div>`;

  return renderPage(
    "Test Accounts",
    `${shellNav(user)}${flash ? `<div class="flash">${esc(flash)}</div>` : ""}
<div class="surface-card">
  <div class="panel-title">
    <div>
      <span class="section-kicker">Credential Pool</span>
      <h2>Test account orchestration</h2>
      <p class="helper">Store the real credentials your synthetic users should log in with. One account is enough for a smoke test, and you can scale up later.</p>
    </div>
    <div class="pill-row">
      <span class="pill">${selectedEnvironment ? esc(selectedEnvironment.name) : "No environment"}</span>
      <span class="pill">${accounts.length} account${accounts.length === 1 ? "" : "s"}</span>
    </div>
  </div>
  <div class="dial-grid">
    ${renderDialCard("Available", percent(availableCount, Math.max(accounts.length, 1)), "#58ff94", "ready for agents")}
    ${renderDialCard("Reserved", percent(reservedCount, Math.max(accounts.length, 1)), "#ffb649", "currently in use")}
    ${renderDialCard("Disabled", percent(disabledCount, Math.max(accounts.length, 1)), "#ff6b86", "blocked from runs")}
    ${renderDialCard("Shared use", percent(concurrentCount, Math.max(accounts.length, 1)), "#a8ff60", "concurrent enabled")}
  </div>
</div>
<div class="panel-grid">
  <div class="surface-card">
    <span class="section-kicker">Environment Target</span>
    <h2>Choose environment</h2>
    ${environmentPicker}
    ${accountForm}
  </div>
  <div class="surface-card">
    <span class="section-kicker">Account Table</span>
    <h2>Existing accounts</h2>
    <div class="table-shell">
      <table style="width:100%;"><thead><tr><th>Label</th><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Concurrent</th><th>Actions</th></tr></thead><tbody>${accountRows || '<tr><td colspan="7"><div class="empty-state">No accounts yet.</div></td></tr>'}</tbody></table>
    </div>
  </div>
</div>`
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
      (workflow) => `<li class="list-item">
        <div class="panel-title">
          <div>
            <strong>${esc(workflow.name)}</strong>
            <div class="list-meta">${esc(workflow.goal)}</div>
          </div>
          <div class="action-row" style="margin-top:0;">
            <a class="button secondary" href="/dashboard/workflows?projectId=${workflow.projectId}&workflowId=${workflow.id}">Edit</a>
            <form method="post" action="/dashboard/workflows/${workflow.id}/delete" class="inline-form">
              <input type="hidden" name="projectId" value="${esc(workflow.projectId)}" />
              <button type="submit" class="danger">Delete</button>
            </form>
          </div>
        </div>
        <div class="pill-row">
          <span class="pill">${esc(workflow.workflowType)}</span>
          <span class="pill">${esc(workflow.status)}</span>
          <span class="pill">${workflow.maxSteps} steps</span>
        </div>
      </li>`
    )
    .join("\n");

  return renderPage(
    "Workflows",
    `${shellNav(user)}
${flash ? `<div class="flash">${esc(flash)}</div>` : ""}
<div class="surface-card">
  <span class="section-kicker">Workflow Builder</span>
  <h2>Goal definitions</h2>
  <p class="helper">Workflows tell the synthetic users what they should accomplish and how success gets recognized.</p>
</div>
<div class="panel-grid">
  <div class="surface-card">
    <span class="section-kicker">Project Target</span>
    <h2>Select project</h2>
    <form method="get" action="/dashboard/workflows" class="grid-2">
      <label>Project<select name="projectId">${projects
        .map((project) => `<option value="${project.id}" ${selectedProject?.id === project.id ? "selected" : ""}>${esc(project.name)}</option>`)
        .join("")}</select></label>
      <div class="page-actions" style="align-self:end;"><button type="submit">Load</button></div>
    </form>
    <div class="dial-grid">
      ${renderDialCard("Workflows", percent(workflows.length, Math.max(workflows.length, 1)), "#39ff88", "defined goals")}
      ${renderDialCard("Active", percent(workflows.filter((workflow) => workflow.status === "ACTIVE").length, Math.max(workflows.length, 1)), "#58ff94", "ready to run")}
      ${renderDialCard("Drafts", percent(workflows.filter((workflow) => workflow.status === "DRAFT").length, Math.max(workflows.length, 1)), "#ffb649", "still being shaped")}
    </div>
  </div>
  <div class="surface-card">
    <span class="section-kicker">Workflow Library</span>
    <h2>Existing workflows</h2>
    <ul class="stack-list">${list || '<li class="list-item"><span class="helper">No workflows yet.</span></li>'}</ul>
  </div>
</div>
${selectedProject ? `<div class="surface-card"><span class="section-kicker">Create Workflow</span><h2>New workflow</h2><form method="post" action="/dashboard/workflows" class="grid-2"><input type="hidden" name="projectId" value="${selectedProject.id}" /><label>Name<input name="name" placeholder="Borrower login" required /></label><label>Workflow Type<input name="workflowType" placeholder="SCRIPTED|GOAL_BASED|EXPLORATORY" value="GOAL_BASED" required /></label><label>Status<input name="status" placeholder="DRAFT|ACTIVE|ARCHIVED" value="DRAFT" required /></label><label>Starting Path<input name="startingPath" placeholder="/login" required /></label><label>Max Steps<input name="maxSteps" placeholder="100" required /></label><label>Max Duration<input name="maxDurationSeconds" placeholder="600" required /></label><label style="grid-column:1/-1;">Goal<input name="goal" placeholder="User completes checkout" required /></label><label style="grid-column:1/-1;">Description<textarea name="description" placeholder="Description"></textarea></label><label style="grid-column:1/-1;">Success Criteria<textarea name="successCriteria" placeholder="URL_CONTAINS: /checkout/success\nPAGE_CONTAINS_TEXT: Thank you" required></textarea></label><div class="page-actions" style="grid-column:1/-1;"><button type="submit">Create Workflow</button></div></form></div>` : "<div class=\"empty-state\">Create a project first.</div>"}
${selectedWorkflow ? `<div class="surface-card"><span class="section-kicker">Edit Workflow</span><h2>${esc(selectedWorkflow.name)}</h2><form method="post" action="/dashboard/workflows/${selectedWorkflow.id}/update" class="grid-2"><input type="hidden" name="projectId" value="${selectedWorkflow.projectId}" /><label>Name<input name="name" value="${esc(selectedWorkflow.name)}" required /></label><label>Workflow Type<input name="workflowType" value="${esc(selectedWorkflow.workflowType)}" required /></label><label>Status<input name="status" value="${esc(selectedWorkflow.status)}" required /></label><label>Starting Path<input name="startingPath" value="${esc(selectedWorkflow.startingPath)}" required /></label><label>Max Steps<input name="maxSteps" value="${selectedWorkflow.maxSteps}" required /></label><label>Max Duration<input name="maxDurationSeconds" value="${selectedWorkflow.maxDurationSeconds}" required /></label><label style="grid-column:1/-1;">Goal<input name="goal" value="${esc(selectedWorkflow.goal)}" required /></label><label style="grid-column:1/-1;">Description<textarea name="description">${esc(selectedWorkflow.description ?? "")}</textarea></label><label style="grid-column:1/-1;">Success Criteria<textarea name="successCriteria" required>${esc(successCriteriaToText(selectedWorkflow.successCriteria || []))}</textarea></label><div class="page-actions" style="grid-column:1/-1;"><button type="submit">Save Workflow</button></div></form></div>` : ""}
`
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
<td><strong>${esc(config.provider)}</strong></td>
<td>${esc(config.model)}</td>
<td><code>${esc(config.baseUrl ?? "-")}</code></td>
<td>${esc(String(config.timeoutMs ?? 30000))}</td>
<td>${renderStatusBadge(config.status)}</td>
<td>${esc(config.lastCheckedAt ? new Date(config.lastCheckedAt).toLocaleString() : "-")}</td>
<td style="max-width:220px;">${esc(config.lastError ?? "-")}</td>
<td>
  <div class="action-row" style="margin-top:0;">
    <form method="post" action="/dashboard/llm-providers/${config.id}/test" class="inline-form"><button type="submit">Test Connection</button></form>
    <form method="post" action="/dashboard/llm-providers/${config.id}/remove" class="inline-form" onsubmit="return window.confirm('Remove this provider connection?');"><button type="submit" class="danger">Remove Connection</button></form>
  </div>
</td>
</tr>`
    )
    .join("\n");

  return renderPage(
    "LLM Providers",
    `${shellNav(user)}
${flash ? `<div class="flash">${esc(flash)}</div>` : ""}
${error ? `<div class="error">${esc(error)}</div>` : ""}
<div class="surface-card">
  <span class="section-kicker">Model Gateway</span>
  <h2>LLM Providers</h2>
  <p class="helper">Manage hosted model credentials separately from the app-under-test. Keep provider keys out of logs and use the built-in test button before a run.</p>
</div>
<div class="panel-grid">
  <div class="surface-card">
    <span class="section-kicker">Add Provider</span>
    <h2>Provider configuration</h2>
    <form method="post" action="/dashboard/llm-providers" class="grid-2">
      <label>Provider
        <select name="provider"><option value="openai">openai</option><option value="anthropic">anthropic</option></select>
      </label>
      <label>Model<input name="model" placeholder="gpt-4o-mini or claude-3-5-haiku-latest" required /></label>
      <label>API Key<input type="password" name="apiKey" required /></label>
      <label>Base URL (optional)<input name="baseUrl" placeholder="https://api.openai.com/v1" /></label>
      <label>Timeout (ms)<input name="timeoutMs" type="number" min="1000" max="120000" value="30000" /></label>
      <label>Status
        <select name="status"><option value="inactive">inactive</option><option value="active">active</option><option value="error">error</option></select>
      </label>
      <div class="page-actions" style="grid-column:1/-1;"><button type="submit">Save Provider</button></div>
    </form>
  </div>
  <div class="surface-card">
    <span class="section-kicker">Provider Health</span>
    <h2>Configured providers</h2>
    <div class="table-shell">
      <table style="width:100%;"><thead><tr><th>Provider</th><th>Model</th><th>Base URL</th><th>Timeout</th><th>Status</th><th>Last Checked</th><th>Last Error</th><th>Action</th></tr></thead><tbody>${rows || '<tr><td colspan="8"><div class="empty-state">No provider configs yet.</div></td></tr>'}</tbody></table>
    </div>
  </div>
</div>`
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

app.post("/dashboard/llm-providers/:configId/remove", async (req, res) => {
  const response = await apiRequest(req.headers.cookie, `/api/llm/providers/${req.params.configId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "inactive", isActive: false })
  });

  if (!response) return void res.redirect("/dashboard/llm-providers?error=Unable+to+remove+provider");
  res.redirect("/dashboard/llm-providers?flash=Provider+connection+removed");
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
  <div class="panel-title">
    <div>
      <span class="section-kicker">Demo Launch Flow</span>
      <h2>Simulation Run Setup</h2>
      <p class="helper">Choose the project, environment, and workflow you want to showcase, then either use the 20-agent demo preset or launch a custom run.</p>
    </div>
    <div class="metrics-grid" style="min-width:min(100%, 430px);">
      ${renderMetricBox("Projects", args.options.projects.length, "available in org")}
      ${renderMetricBox("Active workflows", activeWorkflows.length, "ready to run")}
      ${renderMetricBox("Available accounts", availableAccounts.length, "eligible logins")}
      ${renderMetricBox("Personas", args.options.personas.length, "behavior models")}
    </div>
  </div>
</div>
<div class="panel-grid">
  <div class="surface-card">
    <span class="section-kicker">1. Scope</span>
    <h2>Choose project and environment</h2>
    <p class="helper">These filters only refresh available workflows and test accounts. They do not start a run.</p>
    <form method="get" action="/dashboard/run-setup" class="grid-2">
      <label>Project<select name="projectId" required onchange="this.form.submit()">${args.options.projects
        .map((project) => `<option value="${project.id}" ${selectedProject?.id === project.id ? "selected" : ""}>${esc(project.name)}</option>`)
        .join("")}</select></label>
      <label>Environment<select name="environmentId" required onchange="this.form.submit()">${environments
        .map((environment) => `<option value="${environment.id}" ${args.selectedEnvironmentId === environment.id ? "selected" : ""}>${esc(environment.name)} · ${esc(environment.type)}</option>`)
        .join("")}</select></label>
      <noscript><button type="submit">Refresh options</button></noscript>
    </form>
    ${args.options.projects.length === 0 ? `<div class="empty-state" style="margin-top:16px;">No projects found yet. Create a project first, then add an environment before starting a run.</div>` : ""}
    ${selectedProject && environments.length === 0 ? `<div class="empty-state" style="margin-top:16px;">Project <strong>${esc(selectedProject.name)}</strong> has no environments yet. Add one from the Projects screen to continue.</div>` : ""}
  </div>
  <div class="surface-card">
    <span class="section-kicker">2. Preset</span>
    <h2>20-agent demo</h2>
    <p class="helper">Fastest path for the live walkthrough. This preset picks the configured demo project, environment, workflow, personas, and accounts automatically.</p>
    <div class="pill-row" style="margin-bottom:14px;"><span class="pill">20 agents</span><span class="pill">live dashboard</span><span class="pill">report included</span></div>
    <form method="post" action="/dashboard/demo-runs/20-agent">
      <input type="hidden" name="projectId" value="${esc(selectedProject?.id ?? "")}" />
      <input type="hidden" name="environmentId" value="${esc(args.selectedEnvironmentId ?? "")}" />
      <input type="hidden" name="workflowId" value="${esc(args.selectedWorkflowId ?? activeWorkflows[0]?.id ?? "")}" />
      <button type="submit" data-loading-text="Starting demo run...">Start 20-agent demo preset</button>
    </form>
  </div>
</div>
<div class="surface-card">
  <span class="section-kicker">3. Custom Run</span>
  <h2>Launch a bespoke test</h2>
  ${
    hasSetupPrereqs
      ? `<form method="post" action="/dashboard/run-setup/preview" class="grid-2">
        <input type="hidden" name="projectId" value="${esc(selectedProject?.id ?? "")}" />
        <input type="hidden" name="environmentId" value="${esc(args.selectedEnvironmentId ?? "")}" />
        <label>Workflow<select name="workflowId" required>${activeWorkflows
          .map((workflow) => `<option value="${workflow.id}" ${args.selectedWorkflowId === workflow.id ? "selected" : ""}>${esc(workflow.name)} (${esc(workflow.status)})</option>`)
          .join("")}</select></label>
        <label>Budget Policy<select name="budgetPolicyId" required>${args.options.budgetPolicies.map((policy) => `<option value="${policy.id}">${esc(policy.name)}</option>`).join("")}</select></label>
        <label>Number of Agents<input type="number" min="1" max="100" name="agentCount" value="${Math.min(availableAccounts.length, 5)}" required /></label>
        <label>Max Run Duration (seconds)<input type="number" min="30" max="7200" name="maxRunDurationSeconds" value="600" required /></label>
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
      : `<div class="empty-state" style="margin-top:16px;">The run launcher is waiting on setup data.
          <div style="margin-top:10px;">
            ${args.options.projects.length === 0 ? `<div>Need at least one project.</div>` : ``}
            ${environments.length === 0 ? `<div>Need at least one environment in the selected project.</div>` : ``}
            ${activeWorkflows.length === 0 ? `<div>Need at least one ACTIVE workflow for the selected project.</div>` : ``}
            ${args.options.personas.length === 0 ? `<div>Need at least one persona.</div>` : ``}
            ${availableAccounts.length === 0 ? `<div>Need at least one non-disabled test account in the selected environment.</div>` : ``}
            ${args.options.budgetPolicies.length === 0 ? `<div>Need at least one active budget policy.</div>` : ``}
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


