# MVP Scope

## In Scope
This MVP focuses on proving end-to-end value from scenario execution to decision-ready reporting.

### Core Capabilities
- Synthetic user execution for up to 20 concurrent users.
- Premade test account assignment for authenticated sessions.
- Persona configuration with controlled behavioral variation.
- Playwright automation for browser-based interaction.
- Real-time dashboard for run progress and health.
- Event metrics collection for key run outcomes.
- Markdown report generation after each run.

### Event Metrics (MVP Minimum)
- Run start and run end timestamps.
- Per-user completion status.
- Step-level pass/fail outcome.
- Error counts by category (auth, UI, network, timeout).
- Median and p95 completion duration.

### Delivery Boundaries
- Documentation and scoped implementation planning only for this phase.
- No production hardening beyond MVP-safe defaults.
- No broad multi-workflow orchestration yet.

## Non-Goals
The following are explicitly out of scope for this MVP:
- Autonomous agent frameworks or unrestricted tool-using agents.
- Arbitrary shell or filesystem capabilities for synthetic users.
- Dynamic account provisioning pipelines.
- Full CI/CD policy automation and release gates.
- PDF reporting (markdown only in MVP).
- Enterprise access controls, SSO, and tenant billing.
- Multi-region infra and advanced autoscaling.
- Root-cause AI remediation recommendations.

## Core User Stories
- As a Product Manager, I can run a realistic synthetic user simulation before release and see whether critical flows are stable.
- As a QA Lead, I can observe run progress in real time and identify where failures cluster.
- As an Engineer, I can review run metrics and failure evidence to prioritize fixes quickly.
- As a Team Lead, I can share a markdown report as release-readiness evidence.

## Success Metrics (MVP)
- At least one critical workflow executed end-to-end with 20 synthetic users.
- At least 90% of run events successfully captured and visible in the dashboard.
- Markdown report generated for 100% of completed runs.
- Time to detect major workflow breakage reduced versus current manual validation baseline.
- At least one real product issue discovered before release using this system.