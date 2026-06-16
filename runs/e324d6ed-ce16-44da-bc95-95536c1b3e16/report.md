# Post-Run Report

- Generated: 2026-06-16T00:46:06.379Z
- Run ID: e324d6ed-ce16-44da-bc95-95536c1b3e16
- Status: Failed

## 1. Executive Summary

- Core Validation ran Sign In and Dashboard against staging with 20 requested agents and finished with status Failed.
- 0 agents completed successfully, 20 failed, and 0 actions were recorded across 270 events.
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
- Run duration: 2s.
- Success criteria: URL_CONTAINS=/dashboard

## 5. Key Metrics

| Metric | Value |
| --- | --- |
| Total Events | 270 |
| Total Actions | 0 |
| Completed Agents | 0 |
| Failed Agents | 20 |
| Completed Workflows | 0 |
| Failed Workflows | 60 |
| Technical Errors | 121 |
| Artifacts Captured | 28 |
| Screenshots Captured | 0 |
| Total LLM Tokens | 0 |
| Estimated LLM Cost | $0.0000 |

## 6. Top Findings

- 1. **High** — Workflow failure detected in Sign In and Dashboard. 60 workflow failure events were recorded against the run goal.

## 7. Technical Errors

- 2026-06-16T00:46:00.226Z · workflow.failed · agent c2c3e075-a364-4ec1-8660-9b0bc35e3ab7 · No active LLM provider config available for LLM runner
- 2026-06-16T00:46:00.239Z · workflow.failed · agent bbc7e815-2a68-441d-bc1d-30ecc4876bd8 · No active LLM provider config available for LLM runner
- 2026-06-16T00:46:00.257Z · workflow.failed · agent 51830eb1-64f4-4c2f-a3d9-c6aa264c8e0a · No active LLM provider config available for LLM runner
- 2026-06-16T00:46:00.263Z · agent.failed · agent c2c3e075-a364-4ec1-8660-9b0bc35e3ab7 · No active LLM provider config available for LLM runner
- 2026-06-16T00:46:00.278Z · agent.failed · agent bbc7e815-2a68-441d-bc1d-30ecc4876bd8 · No active LLM provider config available for LLM runner
- 2026-06-16T00:46:00.291Z · agent.failed · agent 51830eb1-64f4-4c2f-a3d9-c6aa264c8e0a · No active LLM provider config available for LLM runner
- 2026-06-16T00:46:00.592Z · workflow.failed · agent 7304ccf3-e6c8-4026-ac81-06e7fba3db25 · No active LLM provider config available for LLM runner
- 2026-06-16T00:46:00.604Z · workflow.failed · agent c9bb2a3b-071c-4670-ad71-bd107e9c0eba · No active LLM provider config available for LLM runner
- 2026-06-16T00:46:00.609Z · workflow.failed · agent c0d7725a-0c08-4126-adf9-0cb5cb867d14 · No active LLM provider config available for LLM runner
- 2026-06-16T00:46:00.624Z · agent.failed · agent 7304ccf3-e6c8-4026-ac81-06e7fba3db25 · No active LLM provider config available for LLM runner

## 8. Screenshots and Artifacts

- Report Pdf · 2026-06-16T00:46:06.166Z · e324d6ed-ce16-44da-bc95-95536c1b3e16/report.pdf
- Report · 2026-06-16T00:46:06.160Z · e324d6ed-ce16-44da-bc95-95536c1b3e16/report.md
- Report Pdf · 2026-06-16T00:46:05.985Z · e324d6ed-ce16-44da-bc95-95536c1b3e16/report.pdf
- Report · 2026-06-16T00:46:05.980Z · e324d6ed-ce16-44da-bc95-95536c1b3e16/report.md
- Report Pdf · 2026-06-16T00:46:05.783Z · e324d6ed-ce16-44da-bc95-95536c1b3e16/report.pdf
- Report · 2026-06-16T00:46:05.779Z · e324d6ed-ce16-44da-bc95-95536c1b3e16/report.md
- Report Pdf · 2026-06-16T00:46:05.683Z · e324d6ed-ce16-44da-bc95-95536c1b3e16/report.pdf
- Report · 2026-06-16T00:46:05.679Z · e324d6ed-ce16-44da-bc95-95536c1b3e16/report.md
- Report Pdf · 2026-06-16T00:46:05.569Z · e324d6ed-ce16-44da-bc95-95536c1b3e16/report.pdf
- Report · 2026-06-16T00:46:05.563Z · e324d6ed-ce16-44da-bc95-95536c1b3e16/report.md
- Report Pdf · 2026-06-16T00:46:05.347Z · e324d6ed-ce16-44da-bc95-95536c1b3e16/report.pdf
- Report · 2026-06-16T00:46:05.341Z · e324d6ed-ce16-44da-bc95-95536c1b3e16/report.md
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
| agent.failed | 60 |
| agent.logged_in | 60 |
| agent.started | 60 |
| workflow.failed | 60 |
| artifact.created | 28 |
| run.failed | 1 |
| run.started | 1 |
