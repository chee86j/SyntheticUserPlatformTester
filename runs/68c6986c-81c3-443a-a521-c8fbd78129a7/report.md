# Post-Run Report

- Generated: 2026-06-16T00:46:57.082Z
- Run ID: 68c6986c-81c3-443a-a521-c8fbd78129a7
- Status: Failed

## 1. Executive Summary

- Core Validation ran Sign In and Dashboard against staging with 20 requested agents and finished with status Failed.
- 0 agents completed successfully, 20 failed, and 0 actions were recorded across 268 events.
- The highest-priority issue was workflow failure detected in sign in and dashboard.

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
| Requested Agents | 20 |
| Max Run Duration | 600s |
| Workflow Max Steps | 40 |
| Workflow Max Duration | 300s |
| Budget Policy | None |
| Budget Caps | Unbounded |

## 3. Persona Breakdown

| Persona | Assigned Agents | Completed | Failed | Avg Frustration | Profile Notes |
| --- | --- | --- | --- | --- | --- |
| Clinical Specialist (Nurse Practitioner) | 14 | 0 | 14 | n/a | moderate technical confidence, moderate patience, high time pressure; needs: high-contrast text |
| Field Technician (Service Technician) | 6 | 0 | 6 | n/a | moderate technical confidence, low patience, high time pressure; needs: large-touch-targets |

## 4. Workflow Results

- Final run status: Failed.
- Agent completion: 0/20 completed, 20 failed.
- Workflow outcomes: 0 completed workflow events, 60 failed workflow events.
- Run duration: 1s.
- Success criteria: URL_CONTAINS=/dashboard

## 5. Key Metrics

| Metric | Value |
| --- | --- |
| Total Events | 268 |
| Total Actions | 0 |
| Completed Agents | 0 |
| Failed Agents | 20 |
| Completed Workflows | 0 |
| Failed Workflows | 60 |
| Technical Errors | 121 |
| Artifacts Captured | 26 |
| Screenshots Captured | 0 |
| Total LLM Tokens | 0 |
| Estimated LLM Cost | $0.0000 |

## 6. Top Findings

- 1. **High** — Workflow failure detected in Sign In and Dashboard. 60 workflow failure events were recorded against the run goal.

## 7. Technical Errors

- 2026-06-16T00:46:51.027Z · workflow.failed · agent b490927a-167d-4c71-9d10-d8ac723f69d2 · No active LLM provider config available for LLM runner
- 2026-06-16T00:46:51.032Z · workflow.failed · agent 1410e0c2-caa8-4a2e-a31b-8c3ffe1334d8 · No active LLM provider config available for LLM runner
- 2026-06-16T00:46:51.038Z · workflow.failed · agent 8a248b3d-de3e-45bd-b13d-3f592980c20c · No active LLM provider config available for LLM runner
- 2026-06-16T00:46:51.048Z · agent.failed · agent b490927a-167d-4c71-9d10-d8ac723f69d2 · No active LLM provider config available for LLM runner
- 2026-06-16T00:46:51.050Z · agent.failed · agent 1410e0c2-caa8-4a2e-a31b-8c3ffe1334d8 · No active LLM provider config available for LLM runner
- 2026-06-16T00:46:51.054Z · agent.failed · agent 8a248b3d-de3e-45bd-b13d-3f592980c20c · No active LLM provider config available for LLM runner
- 2026-06-16T00:46:51.250Z · workflow.failed · agent 9cd208f2-97a4-4c4c-9c78-8f0b11f00c09 · No active LLM provider config available for LLM runner
- 2026-06-16T00:46:51.252Z · workflow.failed · agent 93ed31cc-2fde-4c3e-af9f-78c99cfb36d1 · No active LLM provider config available for LLM runner
- 2026-06-16T00:46:51.259Z · workflow.failed · agent 48989df4-22c2-4393-b881-b95e48141f5d · No active LLM provider config available for LLM runner
- 2026-06-16T00:46:51.280Z · agent.failed · agent 9cd208f2-97a4-4c4c-9c78-8f0b11f00c09 · No active LLM provider config available for LLM runner

## 8. Screenshots and Artifacts

- Report Pdf · 2026-06-16T00:46:56.986Z · 68c6986c-81c3-443a-a521-c8fbd78129a7/report.pdf
- Report · 2026-06-16T00:46:56.980Z · 68c6986c-81c3-443a-a521-c8fbd78129a7/report.md
- Report Pdf · 2026-06-16T00:46:56.772Z · 68c6986c-81c3-443a-a521-c8fbd78129a7/report.pdf
- Report · 2026-06-16T00:46:56.768Z · 68c6986c-81c3-443a-a521-c8fbd78129a7/report.md
- Report Pdf · 2026-06-16T00:46:56.592Z · 68c6986c-81c3-443a-a521-c8fbd78129a7/report.pdf
- Report · 2026-06-16T00:46:56.587Z · 68c6986c-81c3-443a-a521-c8fbd78129a7/report.md
- Report Pdf · 2026-06-16T00:46:56.454Z · 68c6986c-81c3-443a-a521-c8fbd78129a7/report.pdf
- Report · 2026-06-16T00:46:56.450Z · 68c6986c-81c3-443a-a521-c8fbd78129a7/report.md
- Report Pdf · 2026-06-16T00:46:56.245Z · 68c6986c-81c3-443a-a521-c8fbd78129a7/report.pdf
- Report · 2026-06-16T00:46:56.235Z · 68c6986c-81c3-443a-a521-c8fbd78129a7/report.md
- Report Pdf · 2026-06-16T00:46:56.105Z · 68c6986c-81c3-443a-a521-c8fbd78129a7/report.pdf
- Report · 2026-06-16T00:46:56.101Z · 68c6986c-81c3-443a-a521-c8fbd78129a7/report.md
- Additional artifacts not listed: 14

## 9. Budget and LLM Usage

| Category | Value |
| --- | --- |
| Input Tokens | 0 |
| Output Tokens | 0 |
| Total Tokens | 0 |
| Estimated Cost | $0.0000 |
| Remaining Cost Budget | Unbounded |
| Remaining Token Budget | Unbounded |
| Projected Next 1k Tokens Cost | Unbounded |

_No LLM usage records were captured for this run._

## 10. Recommendations

- Review failed workflow steps and improve task completion cues before rollout.

## 11. Appendix: Event Summary

| Event Type | Count |
| --- | --- |
| agent.failed | 60 |
| agent.logged_in | 60 |
| agent.started | 60 |
| workflow.failed | 60 |
| artifact.created | 26 |
| run.failed | 1 |
| run.started | 1 |
