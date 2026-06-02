# Post-Run Report

- Generated: 2026-06-02T01:32:14.576Z
- Run ID: 0ede5a8c-b76f-43c7-a242-68d094f2acdb
- Status: Failed

## 1. Executive Summary

- Core Validation ran Sign In and Dashboard against staging with 2 requested agents and finished with status Failed.
- 0 agents completed successfully, 2 failed, and 12 actions were recorded across 38 events.
- The highest-priority issue was workflow reliability breakdown.

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
- Workflow outcomes: 0 completed workflow events, 3 failed workflow events.
- Run duration: 4s.
- Success criteria: URL_CONTAINS=/dashboard

## 5. Key Metrics

| Metric | Value |
| --- | --- |
| Total Events | 38 |
| Total Actions | 12 |
| Completed Agents | 0 |
| Failed Agents | 2 |
| Completed Workflows | 0 |
| Failed Workflows | 3 |
| Technical Errors | 9 |
| Artifacts Captured | 7 |
| Screenshots Captured | 6 |
| Total LLM Tokens | 0 |
| Estimated LLM Cost | $0.0000 |

## 6. Top Findings

- 1. **High** — Workflow reliability breakdown. 3 workflow failure events were recorded during the run.
- 2. **Medium** — Action execution failures. 3 action failures suggest usability or validation breakdowns on key steps.

## 7. Technical Errors

- 2026-06-02T01:32:09.505Z · action.failed · agent 22b4116c-c945-4826-9461-5719eecae058 · locator.fill: Unexpected token "" while parsing css selector "input[name="username"], input[type="email"],". Did you mean to CSS.escape it? Call log: [2m - waiting for input[name…
- 2026-06-02T01:32:09.512Z · action.failed · agent 37d445e0-29df-4f2c-a3b8-507807be5475 · locator.fill: Unexpected token "" while parsing css selector "input[name="username"], input[type="email"],". Did you mean to CSS.escape it? Call log: [2m - waiting for input[name…
- 2026-06-02T01:32:10.204Z · workflow.failed · agent 22b4116c-c945-4826-9461-5719eecae058 · locator.fill: Unexpected token "" while parsing css selector "input[name="username"], input[type="email"],". Did you mean to CSS.escape it? Call log: [2m - waiting for input[name…
- 2026-06-02T01:32:10.212Z · workflow.failed · agent 37d445e0-29df-4f2c-a3b8-507807be5475 · locator.fill: Unexpected token "" while parsing css selector "input[name="username"], input[type="email"],". Did you mean to CSS.escape it? Call log: [2m - waiting for input[name…
- 2026-06-02T01:32:10.242Z · agent.failed · agent 22b4116c-c945-4826-9461-5719eecae058 · locator.fill: Unexpected token "" while parsing css selector "input[name="username"], input[type="email"],". Did you mean to CSS.escape it? Call log: [2m - waiting for input[name…
- 2026-06-02T01:32:10.253Z · agent.failed · agent 37d445e0-29df-4f2c-a3b8-507807be5475 · locator.fill: Unexpected token "" while parsing css selector "input[name="username"], input[type="email"],". Did you mean to CSS.escape it? Call log: [2m - waiting for input[name…
- 2026-06-02T01:32:13.526Z · action.failed · agent 22b4116c-c945-4826-9461-5719eecae058 · locator.fill: Unexpected token "" while parsing css selector "input[name="username"], input[type="email"],". Did you mean to CSS.escape it? Call log: [2m - waiting for input[name…
- 2026-06-02T01:32:14.365Z · workflow.failed · agent 22b4116c-c945-4826-9461-5719eecae058 · locator.fill: Unexpected token "" while parsing css selector "input[name="username"], input[type="email"],". Did you mean to CSS.escape it? Call log: [2m - waiting for input[name…
- 2026-06-02T01:32:14.407Z · agent.failed · agent 22b4116c-c945-4826-9461-5719eecae058 · locator.fill: Unexpected token "" while parsing css selector "input[name="username"], input[type="email"],". Did you mean to CSS.escape it? Call log: [2m - waiting for input[name…

## 8. Screenshots and Artifacts

- Screenshot · 2026-06-02T01:32:13.465Z · C:\Users\JChee\Documents\SyntheticUserPlatformTester\apps\runner\runs\0ede5a8c-b76f-43c7-a242-68d094f2acdb\22b4116c-c945-4826-9461-5719eecae058\failed-step-2.png
- Screenshot · 2026-06-02T01:32:13.165Z · C:\Users\JChee\Documents\SyntheticUserPlatformTester\apps\runner\runs\0ede5a8c-b76f-43c7-a242-68d094f2acdb\22b4116c-c945-4826-9461-5719eecae058\milestone-goto-1.png
- Report · 2026-06-02T01:32:10.427Z · C:\Users\JChee\Documents\SyntheticUserPlatformTester\apps\runner\runs\0ede5a8c-b76f-43c7-a242-68d094f2acdb\report.md
- Screenshot · 2026-06-02T01:32:09.472Z · C:\Users\JChee\Documents\SyntheticUserPlatformTester\apps\runner\runs\0ede5a8c-b76f-43c7-a242-68d094f2acdb\37d445e0-29df-4f2c-a3b8-507807be5475\failed-step-2.png
- Screenshot · 2026-06-02T01:32:09.463Z · C:\Users\JChee\Documents\SyntheticUserPlatformTester\apps\runner\runs\0ede5a8c-b76f-43c7-a242-68d094f2acdb\22b4116c-c945-4826-9461-5719eecae058\failed-step-2.png
- Screenshot · 2026-06-02T01:32:09.216Z · C:\Users\JChee\Documents\SyntheticUserPlatformTester\apps\runner\runs\0ede5a8c-b76f-43c7-a242-68d094f2acdb\37d445e0-29df-4f2c-a3b8-507807be5475\milestone-goto-1.png
- Screenshot · 2026-06-02T01:32:09.165Z · C:\Users\JChee\Documents\SyntheticUserPlatformTester\apps\runner\runs\0ede5a8c-b76f-43c7-a242-68d094f2acdb\22b4116c-c945-4826-9461-5719eecae058\milestone-goto-1.png

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

- Review the failing workflow steps and improve recovery cues on the blocked path.
- Tighten interaction validation, reduce ambiguity, and add clearer inline guidance.

## 11. Appendix: Event Summary

| Event Type | Count |
| --- | --- |
| artifact.created | 7 |
| action.started | 6 |
| screenshot.captured | 6 |
| action.completed | 3 |
| action.failed | 3 |
| agent.failed | 3 |
| agent.logged_in | 3 |
| agent.started | 3 |
| workflow.failed | 3 |
| run.started | 1 |
