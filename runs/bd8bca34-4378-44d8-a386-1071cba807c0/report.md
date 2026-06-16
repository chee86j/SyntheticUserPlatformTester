# Post-Run Report

- Generated: 2026-06-16T01:32:19.687Z
- Run ID: bd8bca34-4378-44d8-a386-1071cba807c0
- Status: Failed

## 1. Executive Summary

- Core Validation ran Sign In and Dashboard against staging with 20 requested agents and finished with status Failed.
- 0 agents completed successfully, 20 failed, and 40 actions were recorded across 162 events.
- The highest-priority issue was action failures indicate form or interaction validation gaps.

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
- Workflow outcomes: 0 completed workflow events, 20 failed workflow events.
- Run duration: 27s.
- Success criteria: URL_CONTAINS=/dashboard

## 5. Key Metrics

| Metric | Value |
| --- | --- |
| Total Events | 162 |
| Total Actions | 40 |
| Completed Agents | 0 |
| Failed Agents | 20 |
| Completed Workflows | 0 |
| Failed Workflows | 20 |
| Technical Errors | 61 |
| Artifacts Captured | 20 |
| Screenshots Captured | 20 |
| Total LLM Tokens | 0 |
| Estimated LLM Cost | $0.0000 |

## 6. Top Findings

- 1. **High** — Action failures indicate form or interaction validation gaps. 20 action failures indicate interaction or validation breakpoints.
- 2. **High** — Workflow failure detected in Sign In and Dashboard. 20 workflow failure events were recorded against the run goal.
- 3. **Low** — Failure screenshots suggest possible accessibility obstacles. 20 failures occurred with 20 captured screenshots for review.

## 7. Technical Errors

- 2026-06-16T01:31:57.179Z · action.failed · agent 7596d98b-088e-4c10-9993-ee29eb36ca55 · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:31:57.321Z · action.failed · agent 5b9c4edd-f74c-4515-8d78-bae3a7eb05f2 · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:31:57.351Z · action.failed · agent 174136e6-8e08-4401-8a48-04ae62ca2f36 · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:31:57.457Z · workflow.failed · agent 7596d98b-088e-4c10-9993-ee29eb36ca55 · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:31:57.513Z · agent.failed · agent 7596d98b-088e-4c10-9993-ee29eb36ca55 · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:31:57.579Z · workflow.failed · agent 174136e6-8e08-4401-8a48-04ae62ca2f36 · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:31:57.610Z · workflow.failed · agent 5b9c4edd-f74c-4515-8d78-bae3a7eb05f2 · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:31:57.618Z · agent.failed · agent 174136e6-8e08-4401-8a48-04ae62ca2f36 · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:31:57.654Z · agent.failed · agent 5b9c4edd-f74c-4515-8d78-bae3a7eb05f2 · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:32:01.066Z · action.failed · agent 986f172d-8615-433e-a66a-b6b4b9e2df67 · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m

## 8. Screenshots and Artifacts

- Screenshot · 2026-06-16T01:32:19.314Z · bd8bca34-4378-44d8-a386-1071cba807c0/cfb602d2-8526-4cc3-8054-042f7ed50a59/failed-step-1.png
- Screenshot · 2026-06-16T01:32:18.836Z · bd8bca34-4378-44d8-a386-1071cba807c0/06568d6d-b619-4317-8f4d-2e65bd00bf36/failed-step-1.png
- Screenshot · 2026-06-16T01:32:16.088Z · bd8bca34-4378-44d8-a386-1071cba807c0/158e2271-89e9-4679-8c8b-7e8a624517f2/failed-step-1.png
- Screenshot · 2026-06-16T01:32:15.914Z · bd8bca34-4378-44d8-a386-1071cba807c0/33f24198-74be-42e2-9c98-fcc843bd3323/failed-step-1.png
- Screenshot · 2026-06-16T01:32:15.533Z · bd8bca34-4378-44d8-a386-1071cba807c0/efa11438-dfd6-4e2e-8054-684e300fcbd1/failed-step-1.png
- Screenshot · 2026-06-16T01:32:12.612Z · bd8bca34-4378-44d8-a386-1071cba807c0/d51fe712-b241-4647-86b1-c2ae101e3ca2/failed-step-1.png
- Screenshot · 2026-06-16T01:32:12.465Z · bd8bca34-4378-44d8-a386-1071cba807c0/8a5c4c61-97ea-4b79-a24f-a6457c3adb97/failed-step-1.png
- Screenshot · 2026-06-16T01:32:12.190Z · bd8bca34-4378-44d8-a386-1071cba807c0/ea67f675-99c7-4c56-929c-984f42075f1a/failed-step-1.png
- Screenshot · 2026-06-16T01:32:08.522Z · bd8bca34-4378-44d8-a386-1071cba807c0/e0ef8347-ae03-4f26-ae80-87ac03b2df0e/failed-step-1.png
- Screenshot · 2026-06-16T01:32:08.501Z · bd8bca34-4378-44d8-a386-1071cba807c0/877f8df4-48ad-4cb1-b3d4-30b2173d733d/failed-step-1.png
- Screenshot · 2026-06-16T01:32:08.303Z · bd8bca34-4378-44d8-a386-1071cba807c0/8eecaab9-b766-4341-b411-521877acc652/failed-step-1.png
- Screenshot · 2026-06-16T01:32:04.863Z · bd8bca34-4378-44d8-a386-1071cba807c0/e35d84ba-5e8f-450d-8026-20fe0eb41430/failed-step-1.png
- Additional artifacts not listed: 8

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

- Add stricter UI validation feedback and recoverable error states for failed actions.
- Review failed workflow steps and improve task completion cues before rollout.
- Audit focus order, control labels, and visible affordances in failed screens.

## 11. Appendix: Event Summary

| Event Type | Count |
| --- | --- |
| action.failed | 20 |
| action.started | 20 |
| agent.failed | 20 |
| agent.logged_in | 20 |
| agent.started | 20 |
| artifact.created | 20 |
| screenshot.captured | 20 |
| workflow.failed | 20 |
| run.failed | 1 |
| run.started | 1 |
