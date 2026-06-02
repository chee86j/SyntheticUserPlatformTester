# Post-Run Report

- Generated: 2026-06-02T21:23:01.906Z
- Run ID: ce878d95-30a2-493f-8616-7580c4d42971
- Status: Completed

## 1. Executive Summary

- Core Validation ran Sign In and Dashboard against staging with 20 requested agents and finished with status Completed.
- 20 agents completed successfully, 0 failed, and 240 actions were recorded across 442 events.

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
- Run duration: 45s.
- Success criteria: URL_CONTAINS=/dashboard

## 5. Key Metrics

| Metric | Value |
| --- | --- |
| Total Events | 442 |
| Total Actions | 240 |
| Completed Agents | 20 |
| Failed Agents | 0 |
| Completed Workflows | 20 |
| Failed Workflows | 0 |
| Technical Errors | 0 |
| Artifacts Captured | 80 |
| Screenshots Captured | 40 |
| Total LLM Tokens | 0 |
| Estimated LLM Cost | $0.0000 |

## 6. Top Findings

- No material findings were generated for this run.

## 7. Technical Errors

- No technical errors were recorded.

## 8. Screenshots and Artifacts

- Video · 2026-06-02T21:23:00.971Z · ce878d95-30a2-493f-8616-7580c4d42971/fae5a8f0-fafb-4e9b-b890-6e9a5617df59/page@aeba295c370ef72ccba93e6e3d486e5c.webm
- Trace · 2026-06-02T21:23:00.907Z · ce878d95-30a2-493f-8616-7580c4d42971/fae5a8f0-fafb-4e9b-b890-6e9a5617df59/trace.zip
- Screenshot · 2026-06-02T21:23:00.752Z · ce878d95-30a2-493f-8616-7580c4d42971/fae5a8f0-fafb-4e9b-b890-6e9a5617df59/post-login.png
- Video · 2026-06-02T21:23:00.280Z · ce878d95-30a2-493f-8616-7580c4d42971/6785b72c-4b01-4ab2-ad0b-f30be0de0aba/page@e08244adad83e1bc947b5bd99848f104.webm
- Trace · 2026-06-02T21:23:00.237Z · ce878d95-30a2-493f-8616-7580c4d42971/6785b72c-4b01-4ab2-ad0b-f30be0de0aba/trace.zip
- Screenshot · 2026-06-02T21:23:00.148Z · ce878d95-30a2-493f-8616-7580c4d42971/6785b72c-4b01-4ab2-ad0b-f30be0de0aba/post-login.png
- Screenshot · 2026-06-02T21:22:58.674Z · ce878d95-30a2-493f-8616-7580c4d42971/fae5a8f0-fafb-4e9b-b890-6e9a5617df59/milestone-goto-1.png
- Screenshot · 2026-06-02T21:22:57.830Z · ce878d95-30a2-493f-8616-7580c4d42971/6785b72c-4b01-4ab2-ad0b-f30be0de0aba/milestone-goto-1.png
- Video · 2026-06-02T21:22:56.458Z · ce878d95-30a2-493f-8616-7580c4d42971/117b2432-52d3-4c09-8d07-864ab5e232bb/page@8707654b450202f77e5f84fa962946a0.webm
- Trace · 2026-06-02T21:22:56.389Z · ce878d95-30a2-493f-8616-7580c4d42971/117b2432-52d3-4c09-8d07-864ab5e232bb/trace.zip
- Screenshot · 2026-06-02T21:22:56.098Z · ce878d95-30a2-493f-8616-7580c4d42971/117b2432-52d3-4c09-8d07-864ab5e232bb/post-login.png
- Video · 2026-06-02T21:22:55.084Z · ce878d95-30a2-493f-8616-7580c4d42971/58edd24c-2dd2-4b5a-bea7-72fc3b21da89/page@d01a3c5878907fb75a626f64e9ac44c6.webm
- Additional artifacts not listed: 68

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
| artifact.created | 80 |
| screenshot.captured | 40 |
| agent.completed | 20 |
| agent.logged_in | 20 |
| agent.started | 20 |
| workflow.completed | 20 |
| run.completed | 1 |
| run.started | 1 |
