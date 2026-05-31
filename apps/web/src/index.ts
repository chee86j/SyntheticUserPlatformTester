import "dotenv/config";
import cookieParser from "cookie-parser";
import express from "express";
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
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

function renderPage(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${title}</title></head><body style="font-family: sans-serif; max-width: 1080px; margin: 30px auto; padding: 0 12px;">${body}</body></html>`;
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

function shellNav(user: CurrentUser): string {
  return `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;"><div><h1>Synthetic User Dashboard</h1><p>${esc(user.name)} (${esc(user.role)})</p></div><div style="display:flex;gap:12px;"><a href="/dashboard/projects">Projects</a><a href="/dashboard/personas">Personas</a><a href="/dashboard/test-accounts">Test Accounts</a><a href="/dashboard/workflows">Workflows</a><a href="/dashboard/run-setup">Run Setup</a><form method="post" action="/logout"><button type="submit">Log out</button></form></div></div>`;
}

function renderLogin(error?: string): string {
  return renderPage("Platform Login", `<h1>Dashboard Login</h1>${error ? `<p style="color:#b00020;">${esc(error)}</p>` : ""}<form method="post" action="/login"><label>Email</label><br /><input type="email" name="email" required style="width:100%;margin-bottom:12px;" /><br /><label>Password</label><br /><input type="password" name="password" required style="width:100%;margin-bottom:12px;" /><br /><button type="submit">Sign in</button></form>`);
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


type BudgetPolicy = {
  id: string;
  name: string;
  maxRunDurationSeconds: number | null;
};

type RunSetupOptions = {
  projects: Project[];
  personas: Persona[];
  budgetPolicies: BudgetPolicy[];
};

function workflowOptions(workflows: Workflow[]): string {
  return workflows
    .map((workflow) => `<option value="${workflow.id}">${esc(workflow.name)} (${esc(workflow.status)})</option>`)
    .join("");
}

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

  return renderPage(
    "Run Setup",
    `${shellNav(args.user)}
${args.error ? `<p style="color:#b00020;">${esc(args.error)}</p>` : ""}
${args.flash ? `<p style="color:#0a5;">${esc(args.flash)}</p>` : ""}
<h2>Simulation Run Setup</h2>
<form method="post" action="/dashboard/run-setup/preview" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
<label>Project
<select name="projectId" required>
${args.options.projects
  .map(
    (project) =>
      `<option value="${project.id}" ${selectedProject?.id === project.id ? "selected" : ""}>${esc(project.name)}</option>`
  )
  .join("")}
</select>
</label>
<label>Environment
<select name="environmentId" required>
${environments
  .map(
    (environment) =>
      `<option value="${environment.id}" ${args.selectedEnvironmentId === environment.id ? "selected" : ""}>${esc(environment.name)}</option>`
  )
  .join("")}
</select>
</label>
<label>Workflow
<select name="workflowId" required>${workflowOptions(args.workflows)}</select>
</label>
<label>Budget Policy
<select name="budgetPolicyId" required>
${args.options.budgetPolicies.map((policy) => `<option value="${policy.id}">${esc(policy.name)}</option>`).join("")}
</select>
</label>
<label>Number of Agents
<input type="number" min="1" max="100" name="agentCount" value="5" required />
</label>
<label>Max Run Duration (seconds)
<input type="number" min="30" max="7200" name="maxRunDurationSeconds" value="600" required />
</label>
<div>
<h3>Personas</h3>
${personaOptions(args.options.personas)}
</div>
<div>
<h3>Test Accounts</h3>
${testAccountOptions(args.testAccounts)}
</div>
<button type="submit" style="grid-column:1/-1;">Review Summary</button>
</form>`
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
        workflows: workflowsResponse?.workflows ?? [],
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
<h2>Run Summary</h2>
<pre>${esc(JSON.stringify(payload, null, 2))}</pre>
<form method="post" action="/dashboard/run-setup/start">
${Object.entries(payload)
  .map(([key, value]) => {
    if (Array.isArray(value)) {
      return value.map((v) => `<input type="hidden" name="${key}" value="${esc(String(v))}" />`).join("");
    }
    return `<input type="hidden" name="${key}" value="${esc(String(value))}" />`;
  })
  .join("")}
<button type="submit">Start Run (Create Pending)</button>
</form>
<a href="/dashboard/run-setup">Back</a>`
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

  const response = await apiRequest<{ run?: { id: string } }>(req.headers.cookie, "/api/simulation-runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response?.run?.id) {
    return void res.redirect("/dashboard/run-setup?error=Run+configuration+is+invalid");
  }

  res.redirect(`/dashboard/run-setup?flash=Pending+run+created:+${response.run.id}`);
});

