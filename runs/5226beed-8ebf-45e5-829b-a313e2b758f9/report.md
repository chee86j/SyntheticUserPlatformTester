# Post-Run Report

- Generated: 2026-06-16T01:03:21.880Z
- Run ID: 5226beed-8ebf-45e5-829b-a313e2b758f9
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
- Run duration: 29s.
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

- 2026-06-16T01:02:57.626Z · action.failed · agent 63b69f34-176d-4d5a-b9e9-9823c6ac63e3 · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:02:57.631Z · action.failed · agent 90e22d5f-31d6-410f-96f4-fc8731fb5b69 · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:02:57.640Z · action.failed · agent 1d4ed358-8f44-4cfb-9134-44213b79420c · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:02:57.943Z · workflow.failed · agent 1d4ed358-8f44-4cfb-9134-44213b79420c · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:02:57.945Z · workflow.failed · agent 90e22d5f-31d6-410f-96f4-fc8731fb5b69 · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:02:57.946Z · workflow.failed · agent 63b69f34-176d-4d5a-b9e9-9823c6ac63e3 · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:02:57.972Z · agent.failed · agent 90e22d5f-31d6-410f-96f4-fc8731fb5b69 · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:02:57.974Z · agent.failed · agent 1d4ed358-8f44-4cfb-9134-44213b79420c · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:02:57.979Z · agent.failed · agent 63b69f34-176d-4d5a-b9e9-9823c6ac63e3 · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:03:01.373Z · action.failed · agent b3fb4af8-94cb-4f83-80c2-af450fcddfd0 · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m

## 8. Screenshots and Artifacts

- Screenshot · 2026-06-16T01:03:21.299Z · 5226beed-8ebf-45e5-829b-a313e2b758f9/11c7b2e0-9916-45da-bb6c-316dcaba4bdc/failed-step-1.png
- Screenshot · 2026-06-16T01:03:21.169Z · 5226beed-8ebf-45e5-829b-a313e2b758f9/e70057a6-5bb7-439f-852b-81fcaf467231/failed-step-1.png
- Screenshot · 2026-06-16T01:03:18.147Z · 5226beed-8ebf-45e5-829b-a313e2b758f9/d1e3c571-2c42-4d6c-9d58-df135bdafaed/failed-step-1.png
- Screenshot · 2026-06-16T01:03:17.377Z · 5226beed-8ebf-45e5-829b-a313e2b758f9/a5a6efe7-3912-44e5-9acd-b98e527cab4c/failed-step-1.png
- Screenshot · 2026-06-16T01:03:17.258Z · 5226beed-8ebf-45e5-829b-a313e2b758f9/ae1613f7-800f-4ddd-9ed5-1c84b97dd265/failed-step-1.png
- Screenshot · 2026-06-16T01:03:13.782Z · 5226beed-8ebf-45e5-829b-a313e2b758f9/c24f1984-e668-4efc-a074-63ec01192040/failed-step-1.png
- Screenshot · 2026-06-16T01:03:13.301Z · 5226beed-8ebf-45e5-829b-a313e2b758f9/f83a0a1e-3699-46ca-9b0b-fa5e6fb4965b/failed-step-1.png
- Screenshot · 2026-06-16T01:03:13.123Z · 5226beed-8ebf-45e5-829b-a313e2b758f9/ccbc7ace-a73d-4df4-a031-6fc2a6db2a39/failed-step-1.png
- Screenshot · 2026-06-16T01:03:09.391Z · 5226beed-8ebf-45e5-829b-a313e2b758f9/67fc6586-17db-4214-912d-3112c3cdae67/failed-step-1.png
- Screenshot · 2026-06-16T01:03:09.126Z · 5226beed-8ebf-45e5-829b-a313e2b758f9/f49bfd5b-f08f-438f-a724-b20b649e9f37/failed-step-1.png
- Screenshot · 2026-06-16T01:03:09.037Z · 5226beed-8ebf-45e5-829b-a313e2b758f9/6bdf2793-23ef-42ee-8b1e-92bcdc96ad6d/failed-step-1.png
- Screenshot · 2026-06-16T01:03:05.470Z · 5226beed-8ebf-45e5-829b-a313e2b758f9/ddd513a1-363c-466e-926b-ed22dc558aaa/failed-step-1.png
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
