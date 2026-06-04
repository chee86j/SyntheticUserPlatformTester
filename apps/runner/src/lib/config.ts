import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  RUNNER_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_BASE_URL: z.string().url(),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  AUTH_COOKIE_NAME: z.string().min(1).default("sup_session"),
  OTEL_ENABLED: z.coerce.boolean().default(false),
  OTEL_CONSOLE_EXPORT_ENABLED: z.coerce.boolean().default(false),
  OTEL_METRIC_EXPORT_INTERVAL_MS: z.coerce.number().int().min(1000).max(60000).default(5000),
  RUNNER_API_EMAIL: z.string().email().default("admin@syntheticlabs.local"),
  RUNNER_API_PASSWORD: z.string().min(1).default("ChangeMe123!"),
  RUN_ID: z.string().uuid().optional(),
  RUNNER_AGENT_ID: z.string().uuid().optional(),
  RUNNER_HEADLESS: z.coerce.boolean().default(true),
  RUNNER_SLOW_MO_MS: z.coerce.number().int().min(0).max(5000).default(0),
  RUNNER_NAV_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(20000),
  MAX_PARALLEL_AGENTS: z.coerce.number().int().min(1).max(50).default(3),
  RUNNER_RECORD_VIDEO: z.coerce.boolean().default(false),
  RUNNER_DEFAULT_PASSWORD: z.string().min(1).default("Password123!"),
  TEST_ACCOUNT_ENCRYPTION_KEY: z.string().min(32),
  RUNNER_LOGIN_USERNAME_SELECTOR: z.string().default('input[name="username"], input[type="email"], #username'),
  RUNNER_LOGIN_PASSWORD_SELECTOR: z.string().default('input[name="password"], #password'),
  RUNNER_LOGIN_SUBMIT_SELECTOR: z.string().default('button[type="submit"], input[type="submit"]'),
  RUNNER_SCRIPT_JSON: z.string().optional(),
  RUNNER_USE_LLM: z.coerce.boolean().default(false),
  RUNNER_LLM_PROVIDER_CONFIG_ID: z.string().uuid().optional(),
  RUNNER_OBS_TEXT_MAX_CHARS: z.coerce.number().int().min(200).max(8000).default(1600)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid runner environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`- ${issue.path.join(".") || "env"}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
