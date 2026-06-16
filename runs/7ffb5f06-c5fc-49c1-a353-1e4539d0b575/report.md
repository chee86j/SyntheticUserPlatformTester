# Post-Run Report

- Generated: 2026-06-16T01:18:20.850Z
- Run ID: 7ffb5f06-c5fc-49c1-a353-1e4539d0b575
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

- 2026-06-16T01:17:58.850Z · action.failed · agent a06300d4-28e0-4777-95a4-6f2ca6594aaa · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:17:58.917Z · action.failed · agent 6d663e28-a6e0-4ef5-b9ce-e274cfb18c6d · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:17:58.969Z · action.failed · agent 7fa02e3f-e10e-4ce7-9521-73b01f7d7936 · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:17:59.078Z · workflow.failed · agent a06300d4-28e0-4777-95a4-6f2ca6594aaa · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:17:59.144Z · agent.failed · agent a06300d4-28e0-4777-95a4-6f2ca6594aaa · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:17:59.150Z · workflow.failed · agent 6d663e28-a6e0-4ef5-b9ce-e274cfb18c6d · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:17:59.221Z · agent.failed · agent 6d663e28-a6e0-4ef5-b9ce-e274cfb18c6d · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:17:59.252Z · workflow.failed · agent 7fa02e3f-e10e-4ce7-9521-73b01f7d7936 · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:17:59.295Z · agent.failed · agent 7fa02e3f-e10e-4ce7-9521-73b01f7d7936 · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m
- 2026-06-16T01:18:02.641Z · action.failed · agent 3ff033cc-28e1-474f-9578-829bc702fb29 · page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4010/login Call log: [2m - navigating to "http://127.0.0.1:4010/login", waiting until "domcontentloaded"[22m

## 8. Screenshots and Artifacts

- Screenshot · 2026-06-16T01:18:20.519Z · 7ffb5f06-c5fc-49c1-a353-1e4539d0b575/302e4a5a-3b6d-4d28-941f-ab1cf53cc9b6/failed-step-1.png
- Screenshot · 2026-06-16T01:18:19.976Z · 7ffb5f06-c5fc-49c1-a353-1e4539d0b575/4ad2b4a2-57d3-4e37-8b5d-2209a3cba4ec/failed-step-1.png
- Screenshot · 2026-06-16T01:18:17.462Z · 7ffb5f06-c5fc-49c1-a353-1e4539d0b575/30c6ebd5-3121-4b95-a543-980544d3b1c7/failed-step-1.png
- Screenshot · 2026-06-16T01:18:17.397Z · 7ffb5f06-c5fc-49c1-a353-1e4539d0b575/ee8545d4-1de4-4943-a39a-749d512cfe8f/failed-step-1.png
- Screenshot · 2026-06-16T01:18:16.902Z · 7ffb5f06-c5fc-49c1-a353-1e4539d0b575/61532950-1947-4966-a149-41ec5a8bb48d/failed-step-1.png
- Screenshot · 2026-06-16T01:18:13.768Z · 7ffb5f06-c5fc-49c1-a353-1e4539d0b575/25052a93-3b9c-4b48-8919-7d1d37d29bfb/failed-step-1.png
- Screenshot · 2026-06-16T01:18:13.709Z · 7ffb5f06-c5fc-49c1-a353-1e4539d0b575/980d381b-8983-42c3-848e-578712af7e29/failed-step-1.png
- Screenshot · 2026-06-16T01:18:13.502Z · 7ffb5f06-c5fc-49c1-a353-1e4539d0b575/a8abcc02-ab44-4788-9d16-845111dd4f39/failed-step-1.png
- Screenshot · 2026-06-16T01:18:10.259Z · 7ffb5f06-c5fc-49c1-a353-1e4539d0b575/76cf8ca9-bd28-4de2-a1cc-4f9159a847d2/failed-step-1.png
- Screenshot · 2026-06-16T01:18:10.225Z · 7ffb5f06-c5fc-49c1-a353-1e4539d0b575/96feabb5-b3a7-45b1-9cde-f2ac72c34d18/failed-step-1.png
- Screenshot · 2026-06-16T01:18:09.983Z · 7ffb5f06-c5fc-49c1-a353-1e4539d0b575/605056ff-cf66-4f16-b163-0a29a8712a67/failed-step-1.png
- Screenshot · 2026-06-16T01:18:06.746Z · 7ffb5f06-c5fc-49c1-a353-1e4539d0b575/734f315d-baac-4a70-872e-16a786550ffd/failed-step-1.png
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
