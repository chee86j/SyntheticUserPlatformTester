# Synthetic User Validation Platform

This repository is a TypeScript monorepo foundation for the Synthetic User Validation Platform.

## Repository Structure

- `apps/web` - future frontend dashboard app
- `apps/api` - backend API app (currently includes `GET /health`)
- `apps/runner` - future synthetic user execution runner
- `packages/shared` - shared types and common utilities
- `packages/database` - database schema and data access package
- `packages/personas` - persona models and configuration package
- `packages/workflows` - workflow definitions package
- `packages/llm-gateway` - LLM provider adapter package
- `packages/browser-agent` - browser automation abstractions package
- `packages/reports` - report generation package
- `packages/telemetry` - metrics and tracing package
- `infra/docker` - Docker Compose for local PostgreSQL and Redis
- `docs` - product and planning documentation

## Local Development

1. Install dependencies:
   - `npm install`
2. Create local environment files:
   - Copy `.env.example` to `.env`
   - Copy `apps/api/.env.example` to `apps/api/.env`
3. Validate and start infra:
   - `docker compose --env-file .env -f infra/docker/docker-compose.yml config`
   - `docker compose --env-file .env -f infra/docker/docker-compose.yml up -d`
4. Start API locally:
   - `npm run dev:api`
5. Check health endpoint:
   - `http://localhost:3001/health`

## Quality Commands

- `npm run lint`
- `npm run typecheck`
- `npm run format`
- `npm run test`

## Notes

- This phase intentionally avoids business logic.
- API startup fails fast when required env vars are missing.
- Foundation principles: KISS, SRP, YAGNI.
