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
  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="font-family: sans-serif; max-width: 980px; margin: 40px auto; padding: 0 12px;">
${body}
</body>
</html>`;
}

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function fetchCurrentUser(cookieHeader: string | undefined): Promise<CurrentUser | null> {
  if (!cookieHeader) {
    return null;
  }

  const response = await fetch(`${env.API_BASE_URL}/auth/me`, {
    method: "GET",
    headers: {
      cookie: cookieHeader
    }
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { user: CurrentUser };
  return payload.user;
}

async function apiRequest<T>(
  cookieHeader: string | undefined,
  path: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
): Promise<T | null> {
  const response = await fetch(`${env.API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(cookieHeader ? { cookie: cookieHeader } : {})
    }
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as T;
}

function renderLogin(error?: string): string {
  return renderPage(
    "Platform Login",
    `<h1>Dashboard Login</h1>
${error ? `<p style="color: #b00020;">${esc(error)}</p>` : ""}
<form method="post" action="/login">
  <label>Email</label><br />
  <input type="email" name="email" required style="width: 100%; margin-bottom: 12px;" /><br />
  <label>Password</label><br />
  <input type="password" name="password" required style="width: 100%; margin-bottom: 12px;" /><br />
  <button type="submit">Sign in</button>
</form>`
  );
}

function renderProjectsPage(
  user: CurrentUser,
  projects: Project[],
  selectedProjectId?: string,
  flash?: string
): string {
  const selectedProject = selectedProjectId
    ? projects.find((project) => project.id === selectedProjectId)
    : projects[0];

  const projectsHtml = projects
    .map(
      (project) => `<li style="border:1px solid #ddd;padding:12px;margin-bottom:10px;">
<div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;">
  <div>
    <strong>${esc(project.name)}</strong><br />
    <small>ID: ${esc(project.id)}</small>
  </div>
  <div style="display:flex;gap:8px;">
    <a href="/dashboard/projects?projectId=${encodeURIComponent(project.id)}">Manage</a>
    <form method="post" action="/dashboard/projects/${project.id}/delete" style="display:inline;">
      <button type="submit">Delete</button>
    </form>
  </div>
</div>
<form method="post" action="/dashboard/projects/${project.id}/update" style="margin-top:10px;">
  <input type="text" name="name" value="${esc(project.name)}" required />
  <button type="submit">Save Name</button>
</form>
</li>`
    )
    .join("\n");

  const environmentRows = (selectedProject?.environments ?? [])
    .map(
      (environment) => `<tr>
<td>${esc(environment.name)}</td>
<td>${esc(environment.baseUrl)}</td>
<td>${esc(environment.type)}</td>
<td>${esc(environment.allowedDomains.join(", "))}</td>
<td>${esc(environment.status)}</td>
<td>
  <form method="post" action="/dashboard/projects/${selectedProject?.id}/environments/${environment.id}/test" style="display:inline;">
    <button type="submit">Test Connection</button>
  </form>
  <form method="post" action="/dashboard/projects/${selectedProject?.id}/environments/${environment.id}/delete" style="display:inline; margin-left: 6px;">
    <button type="submit">Delete</button>
  </form>
</td>
</tr>
<tr><td colspan="6">
  <form method="post" action="/dashboard/projects/${selectedProject?.id}/environments/${environment.id}/update" style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr auto;gap:8px;align-items:center;">
    <input name="name" value="${esc(environment.name)}" required />
    <input name="baseUrl" value="${esc(environment.baseUrl)}" required />
    <select name="type">
      <option value="LOCAL" ${environment.type === "LOCAL" ? "selected" : ""}>LOCAL</option>
      <option value="STAGING" ${environment.type === "STAGING" ? "selected" : ""}>STAGING</option>
      <option value="DEMO" ${environment.type === "DEMO" ? "selected" : ""}>DEMO</option>
    </select>
    <input name="allowedDomains" value="${esc(environment.allowedDomains.join(","))}" />
    <select name="status">
      <option value="ACTIVE" ${environment.status === "ACTIVE" ? "selected" : ""}>ACTIVE</option>
      <option value="INACTIVE" ${environment.status === "INACTIVE" ? "selected" : ""}>INACTIVE</option>
      <option value="UNREACHABLE" ${environment.status === "UNREACHABLE" ? "selected" : ""}>UNREACHABLE</option>
    </select>
    <button type="submit">Save</button>
  </form>
</td></tr>`
    )
    .join("\n");

  const environmentsSection = selectedProject
    ? `<h2>Environments for ${esc(selectedProject.name)}</h2>
<table style="width:100%; border-collapse: collapse;">
  <thead>
    <tr>
      <th style="text-align:left;border-bottom:1px solid #ddd;">Name</th>
      <th style="text-align:left;border-bottom:1px solid #ddd;">Base URL</th>
      <th style="text-align:left;border-bottom:1px solid #ddd;">Type</th>
      <th style="text-align:left;border-bottom:1px solid #ddd;">Allowed Domains</th>
      <th style="text-align:left;border-bottom:1px solid #ddd;">Status</th>
      <th style="text-align:left;border-bottom:1px solid #ddd;">Actions</th>
    </tr>
  </thead>
  <tbody>
    ${environmentRows || '<tr><td colspan="6">No environments yet.</td></tr>'}
  </tbody>
</table>
<h3>Add Environment</h3>
<form method="post" action="/dashboard/projects/${selectedProject.id}/environments" style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr auto;gap:8px;align-items:center;">
  <input name="name" placeholder="Name" required />
  <input name="baseUrl" placeholder="https://example.com" required />
  <select name="type">
    <option value="LOCAL">LOCAL</option>
    <option value="STAGING" selected>STAGING</option>
    <option value="DEMO">DEMO</option>
  </select>
  <input name="allowedDomains" placeholder="example.com, api.example.com" />
  <select name="status">
    <option value="ACTIVE" selected>ACTIVE</option>
    <option value="INACTIVE">INACTIVE</option>
    <option value="UNREACHABLE">UNREACHABLE</option>
  </select>
  <button type="submit">Add</button>
</form>`
    : "<p>Select a project to manage environments.</p>";

  return renderPage(
    "Projects",
    `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
  <div>
    <h1>Projects</h1>
    <p>Signed in as ${esc(user.name)} (${esc(user.role)})</p>
  </div>
  <form method="post" action="/logout">
    <button type="submit">Log out</button>
  </form>
</div>
${flash ? `<p style="color:#0a5;">${esc(flash)}</p>` : ""}
<section>
  <h2>Create Project</h2>
  <form method="post" action="/dashboard/projects" style="display:flex;gap:8px;">
    <input name="name" placeholder="Project name" required />
    <button type="submit">Create</button>
  </form>
</section>
<section>
  <h2>All Projects</h2>
  <ul style="list-style:none;padding:0;">
    ${projectsHtml || "<li>No projects yet.</li>"}
  </ul>
</section>
<section>
  ${environmentsSection}
</section>`
  );
}

function parseAllowedDomains(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function ensureAuth(user: CurrentUser | null, res: express.Response): user is CurrentUser {
  if (!user) {
    res.redirect("/login");
    return false;
  }

  return true;
}

app.get("/", async (_req, res) => {
  res.redirect("/dashboard/projects");
});

app.get("/login", async (req, res) => {
  const user = await fetchCurrentUser(req.headers.cookie);
  if (user) {
    res.redirect("/dashboard/projects");
    return;
  }

  res.status(200).type("html").send(renderLogin());
});

app.post("/login", async (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";

  const response = await fetch(`${env.API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    res.status(401).type("html").send(renderLogin("Invalid credentials"));
    return;
  }

  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    res.setHeader("set-cookie", setCookie);
  }

  res.redirect("/dashboard/projects");
});

app.post("/logout", async (req, res) => {
  const response = await fetch(`${env.API_BASE_URL}/auth/logout`, {
    method: "POST",
    headers: req.headers.cookie ? { cookie: req.headers.cookie } : undefined
  });

  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    res.setHeader("set-cookie", setCookie);
  }

  res.redirect("/login");
});

app.get("/dashboard", async (_req, res) => {
  res.redirect("/dashboard/projects");
});

app.get("/dashboard/projects", async (req, res) => {
  const user = await fetchCurrentUser(req.headers.cookie);
  if (!ensureAuth(user, res)) {
    return;
  }

  const projectsResponse = await apiRequest<{ projects: Project[] }>(req.headers.cookie, "/api/projects");
  const projects = projectsResponse?.projects ?? [];
  const selectedProjectId =
    typeof req.query.projectId === "string" ? req.query.projectId : projects[0]?.id;
  const flash = typeof req.query.flash === "string" ? req.query.flash : undefined;

  res.status(200).type("html").send(renderProjectsPage(user, projects, selectedProjectId, flash));
});

app.post("/dashboard/projects", async (req, res) => {
  const payload = { name: typeof req.body.name === "string" ? req.body.name : "" };

  await apiRequest(req.headers.cookie, "/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  res.redirect("/dashboard/projects?flash=Project+created");
});

app.post("/dashboard/projects/:projectId/update", async (req, res) => {
  const payload = { name: typeof req.body.name === "string" ? req.body.name : "" };

  await apiRequest(req.headers.cookie, `/api/projects/${req.params.projectId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  res.redirect(`/dashboard/projects?projectId=${req.params.projectId}&flash=Project+updated`);
});

app.post("/dashboard/projects/:projectId/delete", async (req, res) => {
  await apiRequest(req.headers.cookie, `/api/projects/${req.params.projectId}`, {
    method: "DELETE"
  });

  res.redirect("/dashboard/projects?flash=Project+deleted");
});

app.post("/dashboard/projects/:projectId/environments", async (req, res) => {
  const payload = {
    name: typeof req.body.name === "string" ? req.body.name : "",
    baseUrl: typeof req.body.baseUrl === "string" ? req.body.baseUrl : "",
    type: typeof req.body.type === "string" ? req.body.type : "STAGING",
    allowedDomains: parseAllowedDomains(
      typeof req.body.allowedDomains === "string" ? req.body.allowedDomains : ""
    ),
    status: typeof req.body.status === "string" ? req.body.status : "ACTIVE"
  };

  await apiRequest(req.headers.cookie, `/api/projects/${req.params.projectId}/environments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  res.redirect(`/dashboard/projects?projectId=${req.params.projectId}&flash=Environment+created`);
});

app.post("/dashboard/projects/:projectId/environments/:environmentId/update", async (req, res) => {
  const payload = {
    name: typeof req.body.name === "string" ? req.body.name : "",
    baseUrl: typeof req.body.baseUrl === "string" ? req.body.baseUrl : "",
    type: typeof req.body.type === "string" ? req.body.type : "STAGING",
    allowedDomains: parseAllowedDomains(
      typeof req.body.allowedDomains === "string" ? req.body.allowedDomains : ""
    ),
    status: typeof req.body.status === "string" ? req.body.status : "ACTIVE"
  };

  await apiRequest(
    req.headers.cookie,
    `/api/projects/${req.params.projectId}/environments/${req.params.environmentId}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    }
  );

  res.redirect(`/dashboard/projects?projectId=${req.params.projectId}&flash=Environment+updated`);
});

app.post("/dashboard/projects/:projectId/environments/:environmentId/delete", async (req, res) => {
  await apiRequest(
    req.headers.cookie,
    `/api/projects/${req.params.projectId}/environments/${req.params.environmentId}`,
    {
      method: "DELETE"
    }
  );

  res.redirect(`/dashboard/projects?projectId=${req.params.projectId}&flash=Environment+deleted`);
});

app.post("/dashboard/projects/:projectId/environments/:environmentId/test", async (req, res) => {
  await apiRequest(
    req.headers.cookie,
    `/api/projects/${req.params.projectId}/environments/${req.params.environmentId}/test-connection`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    }
  );

  res.redirect(`/dashboard/projects?projectId=${req.params.projectId}&flash=Connection+test+completed`);
});

app.listen(env.WEB_PORT, () => {
  console.log(`Web listening on http://localhost:${env.WEB_PORT}`);
});

