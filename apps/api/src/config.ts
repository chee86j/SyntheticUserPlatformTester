import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().min(1).max(65535),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  AUTH_JWT_SECRET: z.string().min(32, "AUTH_JWT_SECRET must be at least 32 chars"),
  AUTH_COOKIE_NAME: z.string().min(1).default("sup_session"),
  WEB_ORIGIN: z.string().url("WEB_ORIGIN must be a valid URL"),
  TEST_ACCOUNT_ENCRYPTION_KEY: z
    .string()
    .min(32, "TEST_ACCOUNT_ENCRYPTION_KEY must be at least 32 chars")
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid API environment configuration:");
  for (const issue of parsedEnv.error.issues) {
    console.error(`- ${issue.path.join(".") || "env"}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsedEnv.data;
