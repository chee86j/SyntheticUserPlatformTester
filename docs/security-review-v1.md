# Security Review v1

Date: 2026-06-02
Phase: 24
Goal: Harden the platform before expanding features.

## Summary

This review focused on runner isolation, route protection, credential handling, event/report redaction, artifact safety, and run-creation abuse controls.

Implemented in this phase:

- Synthetic agents remain action-scoped with no shell execution path, no arbitrary tool surface, and no direct file-system primitives.
- Browser traffic for scripted and LLM-driven runners is now restricted to the environment base URL host plus `Environment.allowedDomains`.
- Per-agent timeout enforcement is applied in runner execution.
- Per-agent action limits are enforced for LLM and scripted flows through workflow caps and budget policy caps.
- Per-run budget abuse is reduced through existing LLM budget checks plus explicit run-creation rate limiting.
- Sensitive event payload fields are redacted before persistence and again when events are returned to clients.
- Artifact locators are stored as validated relative paths under the approved runs directory instead of raw absolute paths.
- Artifact content reads reject remote URLs and path traversal attempts.
- RBAC is enforced on protected write routes and execution routes.

## Detailed Review

### Agent runtime

Status:
- No shell access: enforced by design. Synthetic agents can only produce parsed safe actions from `llm-action-parser.ts`, and the executor only allows a narrow action enum.
- No arbitrary tools: enforced by the same parser and executor constraints.
- No unrestricted outbound browsing: implemented via Playwright route interception in scripted and LLM runners.
- Allowed domains only: implemented with shared `isAllowedUrl(...)` checks using `Environment.allowedDomains` plus the environment base host.
- Per-agent timeout: implemented with execution timeout wrappers in runner flows.
- Per-agent action limit: implemented for scripted runs and already bounded for LLM runs.
- Per-run budget limit: existing LLM cost/token/duration checks remain in place; run creation is now rate limited.

### Credentials and secrets

Status:
- API keys are not returned from provider config routes.
- Sensitive provider test errors are redacted before storage/response.
- Test account passwords remain encrypted or secret-referenced and are not returned in API responses.
- Event payloads redact password, token, cookie, authorization, secret, API key, and session-like fields recursively.
- Reports continue to redact secrets in rendered output.

### API

Status:
- Auth remains required for `/api/*` through `requireAuth`.
- Organization scoping remains enforced on run, persona, project, workflow, test account, event, and artifact reads/writes.
- RBAC is now explicit:
  - `OWNER` / `ADMIN`: configuration and write-management routes.
  - `OWNER` / `ADMIN` / `TESTER`: run execution, event emission, account reservation, environment connectivity checks, and LLM execution routes.
  - `VIEWER`: read-only access through existing protected GET routes.
- Run creation rate limiting is implemented per `organizationId:userId` window.

### Artifacts

Status:
- Artifact storage now uses validated relative locators.
- Path traversal is rejected during locator resolution.
- Artifact reads only serve files that resolve under approved run roots.
- Remote artifact URLs are rejected for content serving.
- Metadata remains separate from file bytes: the database stores artifact metadata/locators while file content stays on disk.

## Tests Added

- `packages/shared/src/security.test.ts`
- `apps/runner/src/lib/artifact-storage.test.ts`
- `apps/runner/src/services/event-emitter-service.test.ts`
- `apps/api/src/services/run-create-rate-limiter.test.ts`

## Remaining Risks

- Run-creation rate limiting is currently in-memory, so it does not coordinate across multiple API instances. Move this to Redis before horizontal scaling.
- Report redaction is good for the current report surface, but a shared redaction utility should be adopted there fully to avoid drift over time.
- Socket/realtime consumers still rely on stored event payloads being redacted at write time. That is now true for current flows, but backfilled older events may still contain unsafe data.
- Artifact metadata is still represented by a single locator string in the current Prisma model. A future schema revision should separate storage path, display name, content type, and size into first-class columns.
- Protected GET routes are still broadly readable to all authenticated users. If some run data or artifact metadata should exclude `VIEWER`, tighten those read policies next.

## Recommended Next Step

Phase 25 should move the rate limiter and any run-budget coordination that must survive restarts into Redis, then follow with a schema upgrade for richer artifact metadata.
