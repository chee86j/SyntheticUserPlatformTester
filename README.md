# Synthetic User Validation Platform

This repository is a TypeScript monorepo foundation for the Synthetic User Validation Platform.

The app runs synthetic beta tester agents against a connected web application, records what they saw
and did, and turns the resulting event stream into reports, artifacts, and calibration data.

## Application Workflow

```text
Operator
  |
  | login, configure project/environment/workflow/personas/accounts
  v
apps/web dashboard
  |
  | HTTP + cookie auth
  v
apps/api
  |
  | validates run setup:
  | - project + environment baseUrl
  | - allowedDomains
  | - ACTIVE workflow
  | - selected personas
  | - available test accounts
  | - budget policy
  v
PostgreSQL <------------------------------+
  |                                       |
  | stores orgs, users, personas,         |
  | workflows, accounts, runs, agents,    |
  | events, artifacts, LLM usage, budgets |
  |                                       |
  +--> Redis / BullMQ queues              |
       |                                  |
       | simulation-runs                  |
       v                                  |
apps/runner worker                        |
  |                                  writes events/artifacts
  | creates SimulationAgent rows           |
  | one per selected account/persona       |
  v                                       |
agent-jobs queue                           |
  |                                       |
  | MAX_PARALLEL_AGENTS controls           |
  | concurrent browser agents              |
  v                                       |
Playwright browser agent                   |
  |                                       |
  | scripted mode: generated login/actions |
  | LLM mode: observe page -> prompt LLM   |
  |           -> parse JSON action         |
  |           -> execute safe action       |
  |           -> repeat until success      |
  v                                       |
Connected web application                  |
  |                                       |
  | console/network/action events          |
  | screenshots, video, traces             |
  v                                       |
report-jobs queue                          |
  |                                       |
  v                                       |
Markdown/PDF report + dashboard views <---+
```

The runner enforces network scope before interacting with the target app. It permits the environment
`baseUrl` host plus `allowedDomains`, and blocks everything else through Playwright request routing.

## Repository Structure

- `apps/web` - local dashboard app with login/logout route protection
- `apps/api` - backend API app with auth and protected routes
- `apps/runner` - synthetic user execution runner and BullMQ worker
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

## How Synthetic Beta Tester Agents Are Created

Agents are records in the `SimulationAgent` table. They are created from a run setup, not invented at
runtime without guardrails.

1. Create or seed the platform data:
   - `Persona` rows define tester traits such as role, industry, technical proficiency, patience,
     time pressure, confidence, error recovery, risk tolerance, accessibility needs, and behavior notes.
   - `Workflow` rows define the user goal, starting path, maximum steps/duration, workflow type, and
     success criteria.
   - `TestAccount` rows provide credentials or secret references for the target environment.
   - `Environment` rows provide the target `baseUrl` and `allowedDomains`.
   - `BudgetPolicy` rows cap run cost, tokens, actions, duration, and daily spend.
2. Start a run from the dashboard or `POST /api/simulation-runs`.
3. The API checks the user role, run-create rate limit, environment reachability, account availability,
   active workflow, persona IDs, and budget policy.
4. The API stores a `SimulationRun` with selected persona IDs, selected test account IDs, requested
   agent count, and run duration.
5. `RunOrchestrator` moves the run to `RUNNING`, creates one `SimulationAgent` per selected account
   up to the requested count, assigns personas round-robin from `selectedPersonaIds`, and queues one
   `run-agent` job per agent.
6. Each agent reserves its test account before browsing and releases it when finished or failed.

The seed script creates a default organization, owner login, budget policy, project, staging
environment, five personas, twenty test accounts, and three workflows. The `20-agent demo preset`
uses this pattern to fan out twenty agents across the available persona pool.

## How Agents Document and Predict Workflows

The app documents target workflows by combining explicit workflow definitions with observed browser
behavior.

- Workflow intent comes from `Workflow.goal`, `startingPath`, `workflowType`, `maxSteps`,
  `maxDurationSeconds`, and `successCriteria`.
- In scripted mode, `buildScript` derives a deterministic Playwright action list from the starting path,
  login account, and success criteria.
- In LLM mode, `PageObservationService` summarizes the current URL, page title, visible body text,
  buttons, links, inputs, recent actions, workflow goal, and persona traits.
- `AgentPromptBuilder` asks the model for one strict JSON action: `click`, `type`, `select`, `scroll`,
  `wait`, `goBack`, `finish`, or `fail`.
- `SafeActionExecutor` executes the selected action and captures failure screenshots when needed.
- Agent memory tracks recent actions, frustration, confusion, retry behavior, and abandonment signals.
- Events are stored as `SimulationEvent` rows and streamed to the dashboard: action starts/completions,
  failures, screenshots, artifacts, console errors, network failures, budget events, and run completion.
- Artifacts are stored per run/agent: screenshots, traces, videos when enabled, markdown reports, and
  PDF reports.
- Reports turn the event stream into workflow results, key metrics, persona breakdowns, top findings,
  technical errors, artifact links, LLM token usage, and budget summaries.
- Prediction calibration compares synthetic results with imported actual workflow metrics from CSV:
  task success rate, completion time, error rate, API calls per session, and support ticket count.

The prediction layer is currently calibration-oriented. It estimates synthetic metrics from completed
runs, then compares them to real-world CSV imports so personas and workflows can be tuned over time.

## LLM Provider Options

The current LLM gateway supports `openai` and `anthropic` provider configs stored in
`LlmProviderConfig`. API keys are encrypted at rest, and each completion is tracked in `LlmUsage`.

### External LLM API

Use this path for hosted APIs such as OpenAI, Anthropic, or an OpenAI-compatible gateway.

1. Add a provider in the dashboard under the LLM provider settings, or call `POST /api/llm/providers`.
2. Set:
   - `provider`: `openai` or `anthropic`
   - `model`: the hosted model name
   - `apiKey`: the provider key
   - `baseUrl`: optional override for compatible gateways
   - `timeoutMs`: request timeout, defaulting to 30000
3. Test it with `POST /api/llm/providers/:configId/test`.
4. Start an LLM runner with:

```text
RUNNER_USE_LLM=true
RUNNER_LLM_PROVIDER_CONFIG_ID=<provider-config-id>
```

Hosted model usage is constrained through `BudgetPolicy` and worker concurrency:

- `maxTokensPerRun` blocks new LLM calls before the requested `maxTokens` would exceed the run cap.
- `maxCostPerRun` and `maxDailyCost` are evaluated after usage is recorded.
- `maxActionsPerAgent` limits LLM calls/actions per agent.
- `maxDurationPerRunSeconds` caps run duration.
- `stopOnBudgetExceeded=true` marks the run failed when a budget is exceeded.
- `MAX_PARALLEL_AGENTS` limits how many browser agents can run at once.
- `POST /api/simulation-runs` is rate-limited to 5 run creations per user/org per 60 seconds.

Provider API rate limiting is not yet a first-class config field. To tailor this for production,
add provider throttle settings to `LlmProviderConfig` or `BudgetPolicy`, then enforce them in
`LlmGatewayService.execute` before `provider.complete`:

```text
suggested fields:
  requestsPerMinute
  tokensPerMinute
  maxConcurrentLlmCalls
  retryAfter429

suggested enforcement:
  Redis token bucket per organization/provider/model
  BullMQ limiter for LLM completion jobs, or a small in-process semaphore for MVP
  exponential backoff on provider 429s
  dashboard-visible events when throttling delays an agent
```

For a hosted OpenAI-compatible API, keep `provider=openai` and set `baseUrl` to the gateway's `/v1`
root. The current `OpenAiProvider` posts to `{baseUrl}/chat/completions`.

### Local Ollama Model

Ollama can be used through its OpenAI-compatible API shape. A local setup usually looks like:

```text
ollama pull llama3.1
ollama serve
```

Then configure an LLM provider as:

```text
provider: openai
model: llama3.1
apiKey: ollama
baseUrl: http://localhost:11434/v1
timeoutMs: 120000
```

This works because the gateway's OpenAI provider calls `/chat/completions`, and Ollama exposes an
OpenAI-compatible `/v1/chat/completions` endpoint. Local models often need a larger timeout and lower
agent concurrency than hosted APIs:

```text
RUNNER_USE_LLM=true
MAX_PARALLEL_AGENTS=1
RUNNER_OBS_TEXT_MAX_CHARS=1200
```

To make Ollama an explicit first-class provider instead of an OpenAI-compatible config, update:

- `packages/llm-gateway/src/types.ts` to include `provider: "ollama"`.
- `packages/llm-gateway/src/factory.ts` to instantiate an `OllamaProvider`.
- `apps/api/src/routes/protected.ts` and `packages/database/src/repositories/llm-types.ts` to allow
  `ollama` in provider validation.
- `apps/web/src/index.ts` to show `ollama` in the provider form.
- Cost estimation to return zero or local infrastructure cost instead of hosted token pricing.

## Current Execution Modes

- `npm run start:worker -w @synthetic/runner` starts the BullMQ worker used by normal dashboard runs.
  Its queued multi-agent path currently executes scripted Playwright workflows.
- `npm run start -w @synthetic/runner` with `RUN_ID=<run-id>` can execute a single run and supports
  `RUNNER_USE_LLM=true`.
- To use LLM decision-making for all queued multi-agent jobs, wire `AgentJobProcessor` to branch to
  `runSingleLlmAgent` the same way `apps/runner/src/index.ts` already does, then route completions
  through `/api/llm/complete` for budget tracking.

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
