# Post-Run Report

- Generated: 2026-06-16T01:04:50.796Z
- Run ID: e3b30202-fa4f-425b-b3d1-ef1083195ec1
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
- Run duration: 26s.
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

- 2026-06-16T01:04:28.824Z · action.failed · agent f446d62c-a0eb-4aee-92c6-d15809b85f7f · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:04:29.001Z · workflow.failed · agent f446d62c-a0eb-4aee-92c6-d15809b85f7f · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:04:29.045Z · agent.failed · agent f446d62c-a0eb-4aee-92c6-d15809b85f7f · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:04:29.127Z · action.failed · agent 046c3b29-30b9-439b-b2d0-2185a98f988e · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:04:29.248Z · action.failed · agent ce93ef6b-9c9b-4bea-a532-961cfdaac784 · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:04:29.399Z · workflow.failed · agent 046c3b29-30b9-439b-b2d0-2185a98f988e · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:04:29.449Z · agent.failed · agent 046c3b29-30b9-439b-b2d0-2185a98f988e · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:04:29.473Z · workflow.failed · agent ce93ef6b-9c9b-4bea-a532-961cfdaac784 · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:04:29.530Z · agent.failed · agent ce93ef6b-9c9b-4bea-a532-961cfdaac784 · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:04:32.481Z · action.failed · agent 5ad28b9f-5a71-45cc-b609-bd96811ae7dc · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m

## 8. Screenshots and Artifacts

- Screenshot · 2026-06-16T01:04:50.369Z · e3b30202-fa4f-425b-b3d1-ef1083195ec1/6fa69b5d-447d-4466-a352-e87124856c22/failed-step-1.png
- Screenshot · 2026-06-16T01:04:48.989Z · e3b30202-fa4f-425b-b3d1-ef1083195ec1/9f359aad-2b79-4b44-bbec-7c9254251c0f/failed-step-1.png
- Screenshot · 2026-06-16T01:04:47.243Z · e3b30202-fa4f-425b-b3d1-ef1083195ec1/e4e9a697-5d33-4be8-800b-244bada7ff44/failed-step-1.png
- Screenshot · 2026-06-16T01:04:47.167Z · e3b30202-fa4f-425b-b3d1-ef1083195ec1/93bf16d6-4428-4e08-aa19-2c103e336de3/failed-step-1.png
- Screenshot · 2026-06-16T01:04:46.040Z · e3b30202-fa4f-425b-b3d1-ef1083195ec1/f234c94e-5e85-488f-b116-c02d81641b52/failed-step-1.png
- Screenshot · 2026-06-16T01:04:43.933Z · e3b30202-fa4f-425b-b3d1-ef1083195ec1/2e6bc5d7-3b78-40c8-bad9-c05daf38de90/failed-step-1.png
- Screenshot · 2026-06-16T01:04:43.889Z · e3b30202-fa4f-425b-b3d1-ef1083195ec1/14d383ee-b5a7-4009-a0ea-1ee81178ee94/failed-step-1.png
- Screenshot · 2026-06-16T01:04:42.873Z · e3b30202-fa4f-425b-b3d1-ef1083195ec1/479dbaa5-c8d3-438a-a6eb-6f2ceb29b26d/failed-step-1.png
- Screenshot · 2026-06-16T01:04:40.369Z · e3b30202-fa4f-425b-b3d1-ef1083195ec1/16252c38-a56f-4096-b58f-11dc4efadb3c/failed-step-1.png
- Screenshot · 2026-06-16T01:04:40.238Z · e3b30202-fa4f-425b-b3d1-ef1083195ec1/45fc456f-dd49-4838-ac74-c2e1e6effacd/failed-step-1.png
- Screenshot · 2026-06-16T01:04:39.586Z · e3b30202-fa4f-425b-b3d1-ef1083195ec1/1f3d1f84-8b06-414e-b3c7-ba09529882b9/failed-step-1.png
- Screenshot · 2026-06-16T01:04:36.755Z · e3b30202-fa4f-425b-b3d1-ef1083195ec1/7d6087c4-b2b1-4897-8317-99b6614a4e12/failed-step-1.png
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
