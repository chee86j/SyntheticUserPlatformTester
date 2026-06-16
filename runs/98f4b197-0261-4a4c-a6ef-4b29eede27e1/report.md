# Post-Run Report

- Generated: 2026-06-16T00:51:05.873Z
- Run ID: 98f4b197-0261-4a4c-a6ef-4b29eede27e1
- Status: Failed

## 1. Executive Summary

- Core Validation ran Sign In and Dashboard against staging with 20 requested agents and finished with status Failed.
- 0 agents completed successfully, 19 failed, and 0 actions were recorded across 267 events.
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
| Clinical Specialist (Nurse Practitioner) | 14 | 0 | 13 | n/a | moderate technical confidence, moderate patience, high time pressure; needs: high-contrast text |
| Field Technician (Service Technician) | 6 | 0 | 6 | n/a | moderate technical confidence, low patience, high time pressure; needs: large-touch-targets |

## 4. Workflow Results

- Final run status: Failed.
- Agent completion: 0/20 completed, 19 failed.
- Workflow outcomes: 0 completed workflow events, 59 failed workflow events.
- Run duration: 2s.
- Success criteria: URL_CONTAINS=/dashboard

## 5. Key Metrics

| Metric | Value |
| --- | --- |
| Total Events | 267 |
| Total Actions | 0 |
| Completed Agents | 0 |
| Failed Agents | 19 |
| Completed Workflows | 0 |
| Failed Workflows | 59 |
| Technical Errors | 119 |
| Artifacts Captured | 28 |
| Screenshots Captured | 0 |
| Total LLM Tokens | 0 |
| Estimated LLM Cost | $0.0000 |

## 6. Top Findings

- 1. **High** — Workflow failure detected in Sign In and Dashboard. 59 workflow failure events were recorded against the run goal.

## 7. Technical Errors

- 2026-06-16T00:50:58.339Z · workflow.failed · agent d59bcd06-b4ed-4854-bb37-030e1116826d · No active LLM provider config available for LLM runner
- 2026-06-16T00:50:58.343Z · workflow.failed · agent 39ed0984-b157-44a2-a688-eafc00d8c527 · No active LLM provider config available for LLM runner
- 2026-06-16T00:50:58.344Z · workflow.failed · agent 08bd57c2-6eed-4116-a541-57ec75a2c03c · No active LLM provider config available for LLM runner
- 2026-06-16T00:50:58.367Z · agent.failed · agent d59bcd06-b4ed-4854-bb37-030e1116826d · No active LLM provider config available for LLM runner
- 2026-06-16T00:50:58.369Z · agent.failed · agent 39ed0984-b157-44a2-a688-eafc00d8c527 · No active LLM provider config available for LLM runner
- 2026-06-16T00:50:58.374Z · agent.failed · agent 08bd57c2-6eed-4116-a541-57ec75a2c03c · No active LLM provider config available for LLM runner
- 2026-06-16T00:50:58.605Z · workflow.failed · agent d3ded277-9084-4baa-8f8e-56ed2a647fde · No active LLM provider config available for LLM runner
- 2026-06-16T00:50:58.607Z · workflow.failed · agent d8e7b61f-aff5-4cb5-9982-610080f5d017 · No active LLM provider config available for LLM runner
- 2026-06-16T00:50:58.610Z · workflow.failed · agent d18a42f9-550d-4102-8d42-cedbfa1f4b60 · No active LLM provider config available for LLM runner
- 2026-06-16T00:50:58.632Z · agent.failed · agent d3ded277-9084-4baa-8f8e-56ed2a647fde · No active LLM provider config available for LLM runner

## 8. Screenshots and Artifacts

- Report Pdf · 2026-06-16T00:51:05.449Z · 98f4b197-0261-4a4c-a6ef-4b29eede27e1/report.pdf
- Report · 2026-06-16T00:51:05.444Z · 98f4b197-0261-4a4c-a6ef-4b29eede27e1/report.md
- Report Pdf · 2026-06-16T00:51:05.132Z · 98f4b197-0261-4a4c-a6ef-4b29eede27e1/report.pdf
- Report · 2026-06-16T00:51:05.127Z · 98f4b197-0261-4a4c-a6ef-4b29eede27e1/report.md
- Report Pdf · 2026-06-16T00:51:04.738Z · 98f4b197-0261-4a4c-a6ef-4b29eede27e1/report.pdf
- Report · 2026-06-16T00:51:04.732Z · 98f4b197-0261-4a4c-a6ef-4b29eede27e1/report.md
- Report Pdf · 2026-06-16T00:51:04.381Z · 98f4b197-0261-4a4c-a6ef-4b29eede27e1/report.pdf
- Report · 2026-06-16T00:51:04.375Z · 98f4b197-0261-4a4c-a6ef-4b29eede27e1/report.md
- Report Pdf · 2026-06-16T00:51:04.014Z · 98f4b197-0261-4a4c-a6ef-4b29eede27e1/report.pdf
- Report · 2026-06-16T00:51:04.006Z · 98f4b197-0261-4a4c-a6ef-4b29eede27e1/report.md
- Report Pdf · 2026-06-16T00:51:03.672Z · 98f4b197-0261-4a4c-a6ef-4b29eede27e1/report.pdf
- Report · 2026-06-16T00:51:03.663Z · 98f4b197-0261-4a4c-a6ef-4b29eede27e1/report.md
- Additional artifacts not listed: 16

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
| agent.started | 60 |
| agent.failed | 59 |
| agent.logged_in | 59 |
| workflow.failed | 59 |
| artifact.created | 28 |
| run.failed | 1 |
| run.started | 1 |
