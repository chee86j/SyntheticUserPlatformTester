# Post-Run Report

- Generated: 2026-06-02T01:36:08.437Z
- Run ID: 27d62e1a-0cdc-407e-8a92-fef7f6d46f7b
- Status: Failed

## 1. Executive Summary

- Core Validation ran Sign In and Dashboard against staging with 2 requested agents and finished with status Failed.
- 0 agents completed successfully, 2 failed, and 8 actions were recorded across 26 events.
- The highest-priority issue was action execution failures.

## 2. Run Configuration

| Field | Value |
| --- | --- |
| Project | Core Validation |
| Environment | staging (STAGING) |
| Base URL | http://127.0.0.1:4010 |
| Workflow | Sign In and Dashboard |
| Workflow Goal | User signs in and reaches dashboard |
| Workflow Type | Goal Based |
| Starting Path | /login |
| Requested Agents | 2 |
| Max Run Duration | 180s |
| Workflow Max Steps | 40 |
| Workflow Max Duration | 300s |
| Budget Policy | Default Budget |
| Budget Caps | cost $50.0000, tokens 500000, actions/agent 200, duration 900s |

## 3. Persona Breakdown

| Persona | Assigned Agents | Completed | Failed | Avg Frustration | Profile Notes |
| --- | --- | --- | --- | --- | --- |
| Clinical Specialist (Nurse Practitioner) | 1 | 0 | 1 | n/a | moderate technical confidence, moderate patience, high time pressure; needs: high-contrast text |
| Operations Lead (Operations Manager) | 1 | 0 | 1 | n/a | moderate technical confidence, moderate patience, high time pressure; no declared accessibility needs |

## 4. Workflow Results

- Final run status: Failed.
- Agent completion: 0/2 completed, 2 failed.
- Workflow outcomes: 0 completed workflow events, 2 failed workflow events.
- Run duration: 2s.
- Success criteria: URL_CONTAINS=/dashboard

## 5. Key Metrics

| Metric | Value |
| --- | --- |
| Total Events | 26 |
| Total Actions | 8 |
| Completed Agents | 0 |
| Failed Agents | 2 |
| Completed Workflows | 0 |
| Failed Workflows | 2 |
| Technical Errors | 7 |
| Artifacts Captured | 4 |
| Screenshots Captured | 4 |
| Total LLM Tokens | 0 |
| Estimated LLM Cost | $0.0000 |

## 6. Top Findings

- 1. **Medium** — Action execution failures. 2 action failures suggest usability or validation breakdowns on key steps.
- 2. **Medium** — Workflow reliability breakdown. 2 workflow failure events were recorded during the run.

## 7. Technical Errors

- 2026-06-02T01:36:07.793Z · action.failed · agent 8985eb0f-5a00-4b69-96ee-64a4365c895a · locator.fill: Unexpected token "" while parsing css selector "input[name="username"], input[type="email"],". Did you mean to CSS.escape it? Call log: [2m - waiting for input[name…
- 2026-06-02T01:36:07.849Z · action.failed · agent e92b7d89-fb1c-41d8-8123-ade937f30317 · locator.fill: Unexpected token "" while parsing css selector "input[name="username"], input[type="email"],". Did you mean to CSS.escape it? Call log: [2m - waiting for input[name…
- 2026-06-02T01:36:08.232Z · workflow.failed · agent 8985eb0f-5a00-4b69-96ee-64a4365c895a · locator.fill: Unexpected token "" while parsing css selector "input[name="username"], input[type="email"],". Did you mean to CSS.escape it? Call log: [2m - waiting for input[name…
- 2026-06-02T01:36:08.263Z · agent.failed · agent 8985eb0f-5a00-4b69-96ee-64a4365c895a · locator.fill: Unexpected token "" while parsing css selector "input[name="username"], input[type="email"],". Did you mean to CSS.escape it? Call log: [2m - waiting for input[name…
- 2026-06-02T01:36:08.320Z · workflow.failed · agent e92b7d89-fb1c-41d8-8123-ade937f30317 · locator.fill: Unexpected token "" while parsing css selector "input[name="username"], input[type="email"],". Did you mean to CSS.escape it? Call log: [2m - waiting for input[name…
- 2026-06-02T01:36:08.340Z · agent.failed · agent e92b7d89-fb1c-41d8-8123-ade937f30317 · locator.fill: Unexpected token "" while parsing css selector "input[name="username"], input[type="email"],". Did you mean to CSS.escape it? Call log: [2m - waiting for input[name…
- 2026-06-02T01:36:08.364Z · run.failed · run · One or more agents failed during execution

## 8. Screenshots and Artifacts

- Screenshot · 2026-06-02T01:36:07.813Z · C:\Users\JChee\Documents\SyntheticUserPlatformTester\runs\27d62e1a-0cdc-407e-8a92-fef7f6d46f7b\e92b7d89-fb1c-41d8-8123-ade937f30317\failed-step-2.png
- Screenshot · 2026-06-02T01:36:07.770Z · C:\Users\JChee\Documents\SyntheticUserPlatformTester\runs\27d62e1a-0cdc-407e-8a92-fef7f6d46f7b\8985eb0f-5a00-4b69-96ee-64a4365c895a\failed-step-2.png
- Screenshot · 2026-06-02T01:36:07.644Z · C:\Users\JChee\Documents\SyntheticUserPlatformTester\runs\27d62e1a-0cdc-407e-8a92-fef7f6d46f7b\e92b7d89-fb1c-41d8-8123-ade937f30317\milestone-goto-1.png
- Screenshot · 2026-06-02T01:36:07.597Z · C:\Users\JChee\Documents\SyntheticUserPlatformTester\runs\27d62e1a-0cdc-407e-8a92-fef7f6d46f7b\8985eb0f-5a00-4b69-96ee-64a4365c895a\milestone-goto-1.png

## 9. Budget and LLM Usage

| Category | Value |
| --- | --- |
| Input Tokens | 0 |
| Output Tokens | 0 |
| Total Tokens | 0 |
| Estimated Cost | $0.0000 |
| Remaining Cost Budget | $50.0000 |
| Remaining Token Budget | 500000 |
| Projected Next 1k Tokens Cost | Unbounded |

_No LLM usage records were captured for this run._

## 10. Recommendations

- Tighten interaction validation, reduce ambiguity, and add clearer inline guidance.
- Review the failing workflow steps and improve recovery cues on the blocked path.

## 11. Appendix: Event Summary

| Event Type | Count |
| --- | --- |
| action.started | 4 |
| artifact.created | 4 |
| screenshot.captured | 4 |
| action.completed | 2 |
| action.failed | 2 |
| agent.failed | 2 |
| agent.logged_in | 2 |
| agent.started | 2 |
| workflow.failed | 2 |
| run.failed | 1 |
| run.started | 1 |
