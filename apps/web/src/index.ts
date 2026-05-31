import "dotenv/config";
import cookieParser from "cookie-parser";
import express from "express";
import { z } from "zod";

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

async function fetchCurrentUser(cookieHeader: string | undefined): Promise<{
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
} | null> {
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

  const payload = (await response.json()) as {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      organizationId: string;
    };
  };

  return payload.user;
}

function renderLogin(error?: string): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Platform Login</title>
</head>
<body style="font-family: sans-serif; max-width: 420px; margin: 40px auto;">
  <h1>Dashboard Login</h1>
  ${error ? `<p style="color: #b00020;">${error}</p>` : ""}
  <form method="post" action="/login">
    <label>Email</label><br />
    <input type="email" name="email" required style="width: 100%; margin-bottom: 12px;" /><br />
    <label>Password</label><br />
    <input type="password" name="password" required style="width: 100%; margin-bottom: 12px;" /><br />
    <button type="submit">Sign in</button>
  </form>
</body>
</html>`;
}

app.get("/", async (req, res) => {
  const user = await fetchCurrentUser(req.headers.cookie);
  if (user) {
    res.redirect("/dashboard");
    return;
  }

  res.redirect("/login");
});

app.get("/login", async (req, res) => {
  const user = await fetchCurrentUser(req.headers.cookie);
  if (user) {
    res.redirect("/dashboard");
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

  res.redirect("/dashboard");
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

app.get("/dashboard", async (req, res) => {
  const user = await fetchCurrentUser(req.headers.cookie);
  if (!user) {
    res.redirect("/login");
    return;
  }

  res.status(200).type("html").send(`<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dashboard</title>
</head>
<body style="font-family: sans-serif; max-width: 720px; margin: 40px auto;">
  <h1>Synthetic User Dashboard</h1>
  <p>Welcome, ${user.name} (${user.role})</p>
  <p>Organization: ${user.organizationId}</p>
  <form method="post" action="/logout">
    <button type="submit">Log out</button>
  </form>
</body>
</html>`);
});

app.listen(env.WEB_PORT, () => {
  console.log(`Web listening on http://localhost:${env.WEB_PORT}`);
});
