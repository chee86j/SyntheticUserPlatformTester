# Synthetic User Validation Platform

This repository is a TypeScript monorepo foundation for the Synthetic User Validation Platform.

## Repository Structure

- `apps/web` - future frontend dashboard app
- `apps/api` - future backend API app
- `apps/runner` - future synthetic user execution runner
- `packages/shared` - shared types and common utilities
- `packages/database` - database schema and data access package
- `packages/personas` - persona models and configuration package
- `packages/workflows` - workflow definitions package
- `packages/llm-gateway` - LLM provider adapter package
- `packages/browser-agent` - browser automation abstractions package
- `packages/reports` - report generation package
- `packages/telemetry` - metrics and tracing package
- `infra/docker` - container and local infra assets
- `docs` - product and planning documentation

## Local Development

1. Install dependencies:
   - `npm install`
2. Validate code quality:
   - `npm run lint`
   - `npm run typecheck`
3. Format code:
   - `npm run format`
4. Run tests:
   - `npm run test`

## Notes

- This phase intentionally includes no business logic.
- Workspace packages currently contain minimal placeholders.
- Foundation principles: KISS, SRP, YAGNI.
