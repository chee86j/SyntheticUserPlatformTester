# Post-Run Report

- Generated: 2026-06-16T00:49:08.248Z
- Run ID: e56e9f71-21c6-4b6b-925c-51ac3d8bdf20
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

- 2026-06-16T00:49:02.047Z · workflow.failed · agent da57bf6b-b9d5-4667-93ed-7c1daf67b7aa · No active LLM provider config available for LLM runner
- 2026-06-16T00:49:02.052Z · workflow.failed · agent 53061621-29e8-47bc-a941-9a0744cbadbf · No active LLM provider config available for LLM runner
- 2026-06-16T00:49:02.077Z · workflow.failed · agent 119d2b4f-6c97-4643-843a-76700c4c6f42 · No active LLM provider config available for LLM runner
- 2026-06-16T00:49:02.081Z · agent.failed · agent da57bf6b-b9d5-4667-93ed-7c1daf67b7aa · No active LLM provider config available for LLM runner
- 2026-06-16T00:49:02.085Z · agent.failed · agent 53061621-29e8-47bc-a941-9a0744cbadbf · No active LLM provider config available for LLM runner
- 2026-06-16T00:49:02.102Z · agent.failed · agent 119d2b4f-6c97-4643-843a-76700c4c6f42 · No active LLM provider config available for LLM runner
- 2026-06-16T00:49:02.287Z · workflow.failed · agent 27a659a0-91d8-4e03-83f6-a5f9133e1699 · No active LLM provider config available for LLM runner
- 2026-06-16T00:49:02.290Z · workflow.failed · agent 1d2b8bf0-b0ad-4c73-8714-c2c2c36f29f4 · No active LLM provider config available for LLM runner
- 2026-06-16T00:49:02.315Z · workflow.failed · agent 00991b46-f79e-4981-88c6-109435d61250 · No active LLM provider config available for LLM runner
- 2026-06-16T00:49:02.324Z · agent.failed · agent 27a659a0-91d8-4e03-83f6-a5f9133e1699 · No active LLM provider config available for LLM runner

## 8. Screenshots and Artifacts

- Report Pdf · 2026-06-16T00:49:08.108Z · e56e9f71-21c6-4b6b-925c-51ac3d8bdf20/report.pdf
- Report · 2026-06-16T00:49:08.101Z · e56e9f71-21c6-4b6b-925c-51ac3d8bdf20/report.md
- Report Pdf · 2026-06-16T00:49:07.858Z · e56e9f71-21c6-4b6b-925c-51ac3d8bdf20/report.pdf
- Report · 2026-06-16T00:49:07.852Z · e56e9f71-21c6-4b6b-925c-51ac3d8bdf20/report.md
- Report Pdf · 2026-06-16T00:49:07.662Z · e56e9f71-21c6-4b6b-925c-51ac3d8bdf20/report.pdf
- Report · 2026-06-16T00:49:07.657Z · e56e9f71-21c6-4b6b-925c-51ac3d8bdf20/report.md
- Report Pdf · 2026-06-16T00:49:07.416Z · e56e9f71-21c6-4b6b-925c-51ac3d8bdf20/report.pdf
- Report · 2026-06-16T00:49:07.409Z · e56e9f71-21c6-4b6b-925c-51ac3d8bdf20/report.md
- Report Pdf · 2026-06-16T00:49:07.278Z · e56e9f71-21c6-4b6b-925c-51ac3d8bdf20/report.pdf
- Report · 2026-06-16T00:49:07.271Z · e56e9f71-21c6-4b6b-925c-51ac3d8bdf20/report.md
- Report Pdf · 2026-06-16T00:49:07.131Z · e56e9f71-21c6-4b6b-925c-51ac3d8bdf20/report.pdf
- Report · 2026-06-16T00:49:07.127Z · e56e9f71-21c6-4b6b-925c-51ac3d8bdf20/report.md
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
