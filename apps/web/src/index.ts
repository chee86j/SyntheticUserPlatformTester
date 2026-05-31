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
  return `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;"><div><h1>Synthetic User Dashboard</h1><p>${esc(user.name)} (${esc(user.role)})</p></div><div style="display:flex;gap:12px;"><a href="/dashboard/projects">Projects</a><a href="/dashboard/personas">Personas</a><form method="post" action="/logout"><button type="submit">Log out</button></form></div></div>`;
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
