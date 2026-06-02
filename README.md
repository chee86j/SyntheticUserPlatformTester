# Synthetic User Validation Platform

This repository is a TypeScript monorepo foundation for the Synthetic User Validation Platform.

## Repository Structure

- `apps/web` - local dashboard app with login/logout route protection
- `apps/api` - backend API app with auth and protected routes
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
   - Copy `apps/web/.env.example` to `apps/web/.env`
3. Validate and start infra:
   - `docker compose --env-file .env -f infra/docker/docker-compose.yml config`
   - `docker compose --env-file .env -f infra/docker/docker-compose.yml up -d`
4. Apply DB schema and seed:
   - `npm run prisma:generate -w @synthetic/database`
   - `npm run prisma:migrate -w @synthetic/database`
   - `npm run prisma:seed -w @synthetic/database`
5. Start API and web apps:
   - `npm run dev -w @synthetic/api`
   - `npm run dev -w @synthetic/web`
6. Open dashboard login:
   - `http://localhost:3000/login`

## Local MVP Login

- Email: `admin@syntheticlabs.local`
- Password: `ChangeMe123!`

## Demo Instructions

1. Start infrastructure:
   - `docker compose --env-file .env -f infra/docker/docker-compose.yml up -d`
2. Start the local product stack in three terminals:
   - `npm run dev -w @synthetic/api`
   - `npm run start:worker -w @synthetic/runner`
   - `npm run dev -w @synthetic/web`
3. Open `http://localhost:3000/login` or `http://localhost:3003/login` if you are using the demo port override.
4. Sign in with the local MVP credentials above.
5. Open `Run Setup`.
6. Select the demo project, environment, and active workflow.
7. Start the `20-agent demo preset`.
8. Watch the live run page for metrics, agent activity, artifacts, and the final markdown report link.
9. Confirm the report artifact opens from the run detail page after completion.

## Demo Validation Checklist

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- Confirm the completed run has a `REPORT` artifact.
- Confirm test accounts return to `AVAILABLE`.
- Confirm event payloads and report output do not expose passwords, cookies, or API keys.

## Quality Commands

- `npm run lint`
- `npm run typecheck`
- `npm run format`
- `npm run test`
