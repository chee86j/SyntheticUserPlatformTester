# Post-Run Report

- Generated: 2026-06-04T01:07:51.858Z
- Run ID: 46345d3c-8563-4dfd-bb6e-0998a8e6156f
- Status: Completed

## 1. Executive Summary

- Core Validation ran Sign In and Dashboard against staging with 20 requested agents and finished with status Completed.
- 20 agents completed successfully, 0 failed, and 240 actions were recorded across 443 events.

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
| Clinical Specialist (Nurse Practitioner) | 14 | 14 | 0 | n/a | moderate technical confidence, moderate patience, high time pressure; needs: high-contrast text |
| Field Technician (Service Technician) | 6 | 6 | 0 | n/a | moderate technical confidence, low patience, high time pressure; needs: large-touch-targets |

## 4. Workflow Results

- Final run status: Completed.
- Agent completion: 20/20 completed, 0 failed.
- Workflow outcomes: 20 completed workflow events, 0 failed workflow events.
- Run duration: 33s.
- Success criteria: URL_CONTAINS=/dashboard

## 5. Key Metrics

| Metric | Value |
| --- | --- |
| Total Events | 443 |
| Total Actions | 240 |
| Completed Agents | 20 |
| Failed Agents | 0 |
| Completed Workflows | 20 |
| Failed Workflows | 0 |
| Technical Errors | 0 |
| Artifacts Captured | 81 |
| Screenshots Captured | 40 |
| Total LLM Tokens | 0 |
| Estimated LLM Cost | $0.0000 |

## 6. Top Findings

- No material findings were generated for this run.

## 7. Technical Errors

- No technical errors were recorded.

## 8. Screenshots and Artifacts

- Report · 2026-06-04T00:47:57.369Z · 46345d3c-8563-4dfd-bb6e-0998a8e6156f/report.md
- Video · 2026-06-04T00:47:56.692Z · 46345d3c-8563-4dfd-bb6e-0998a8e6156f/a1734231-b31d-4b17-996f-c0a608426603/page@77bd154a1a079093b5654e729282cf59.webm
- Trace · 2026-06-04T00:47:56.660Z · 46345d3c-8563-4dfd-bb6e-0998a8e6156f/a1734231-b31d-4b17-996f-c0a608426603/trace.zip
- Screenshot · 2026-06-04T00:47:56.590Z · 46345d3c-8563-4dfd-bb6e-0998a8e6156f/a1734231-b31d-4b17-996f-c0a608426603/post-login.png
- Video · 2026-06-04T00:47:56.578Z · 46345d3c-8563-4dfd-bb6e-0998a8e6156f/b49bce53-f283-4d62-b490-887a4eedb040/page@dc1b35a137114d2de01b89d7181a4d89.webm
- Trace · 2026-06-04T00:47:56.541Z · 46345d3c-8563-4dfd-bb6e-0998a8e6156f/b49bce53-f283-4d62-b490-887a4eedb040/trace.zip
- Screenshot · 2026-06-04T00:47:56.464Z · 46345d3c-8563-4dfd-bb6e-0998a8e6156f/b49bce53-f283-4d62-b490-887a4eedb040/post-login.png
- Screenshot · 2026-06-04T00:47:54.789Z · 46345d3c-8563-4dfd-bb6e-0998a8e6156f/a1734231-b31d-4b17-996f-c0a608426603/milestone-goto-1.png
- Screenshot · 2026-06-04T00:47:54.713Z · 46345d3c-8563-4dfd-bb6e-0998a8e6156f/b49bce53-f283-4d62-b490-887a4eedb040/milestone-goto-1.png
- Video · 2026-06-04T00:47:53.083Z · 46345d3c-8563-4dfd-bb6e-0998a8e6156f/5d55c192-cf72-41d7-ab6b-268fc3182be4/page@170ee17a7597c30da364d484b1529131.webm
- Video · 2026-06-04T00:47:53.063Z · 46345d3c-8563-4dfd-bb6e-0998a8e6156f/9b8a0917-f376-4b57-a297-af0fc3644636/page@58ad5402a3059b319de4f91c529194cd.webm
- Trace · 2026-06-04T00:47:53.032Z · 46345d3c-8563-4dfd-bb6e-0998a8e6156f/5d55c192-cf72-41d7-ab6b-268fc3182be4/trace.zip
- Additional artifacts not listed: 69

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

- No additional recommendations at this time.

## 11. Appendix: Event Summary

| Event Type | Count |
| --- | --- |
| action.completed | 120 |
| action.started | 120 |
| artifact.created | 81 |
| screenshot.captured | 40 |
| agent.completed | 20 |
| agent.logged_in | 20 |
| agent.started | 20 |
| workflow.completed | 20 |
| run.completed | 1 |
| run.started | 1 |
