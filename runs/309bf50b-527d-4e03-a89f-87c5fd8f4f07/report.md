# Post-Run Report

- Generated: 2026-06-16T01:38:02.932Z
- Run ID: 309bf50b-527d-4e03-a89f-87c5fd8f4f07
- Status: Completed

## 1. Executive Summary

- Core Validation ran Sign In and Dashboard against staging with 20 requested agents and finished with status Completed.
- 20 agents completed successfully, 0 failed, and 240 actions were recorded across 442 events.
- The highest-priority issue was console errors indicate runtime defects.

## 2. Run Configuration

| Field | Value |
| --- | --- |
| Project | Core Validation |
| Environment | staging (STAGING) |
| Base URL | http://127.0.0.1:5173 |
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
- Run duration: 3m 3s.
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
| Technical Errors | 20 |
| Artifacts Captured | 60 |
| Screenshots Captured | 40 |
| Total LLM Tokens | 0 |
| Estimated LLM Cost | $0.0000 |

## 6. Top Findings

- 1. **High** — Console errors indicate runtime defects. 20 console errors were emitted during simulation.

## 7. Technical Errors

- 2026-06-16T01:35:02.893Z · console.error · agent 1ddd787b-5a92-457b-8cea-be166ebc7498 · Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector
- 2026-06-16T01:35:02.894Z · console.error · agent 436071a7-0b51-4a4b-9a7d-eb9a192ab149 · Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector
- 2026-06-16T01:35:03.053Z · console.error · agent ea0c34b8-05b0-427a-ac2a-08d70b1e37ae · Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector
- 2026-06-16T01:35:28.786Z · console.error · agent a53120b7-e5c7-4027-be83-13133b7a2675 · Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector
- 2026-06-16T01:35:28.857Z · console.error · agent 0399e3ec-790d-4f6e-be1c-150df1d97261 · Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector
- 2026-06-16T01:35:28.979Z · console.error · agent a8d7fdfc-8d52-4b79-8302-5d49ced4164a · Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector
- 2026-06-16T01:35:54.778Z · console.error · agent 588a014f-af99-4195-9b47-4b24eb64f98c · Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector
- 2026-06-16T01:35:55.127Z · console.error · agent 1e8582c3-ce95-4f14-962a-acf7a78a0828 · Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector
- 2026-06-16T01:35:55.252Z · console.error · agent b846bb53-7f84-4bae-81aa-b73d7ffcccd5 · Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector
- 2026-06-16T01:36:20.359Z · console.error · agent 5ba89135-aee2-45a5-8191-06bfefc4304c · Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector

## 8. Screenshots and Artifacts

- Trace · 2026-06-16T01:38:02.423Z · 309bf50b-527d-4e03-a89f-87c5fd8f4f07/5b9eb833-374b-4a63-8784-1a5851167281/trace.zip
- Trace · 2026-06-16T01:38:02.329Z · 309bf50b-527d-4e03-a89f-87c5fd8f4f07/ed4f9752-c9cf-4eb2-ac3e-f52cf443c4d3/trace.zip
- Screenshot · 2026-06-16T01:38:02.201Z · 309bf50b-527d-4e03-a89f-87c5fd8f4f07/5b9eb833-374b-4a63-8784-1a5851167281/post-login.png
- Screenshot · 2026-06-16T01:38:02.143Z · 309bf50b-527d-4e03-a89f-87c5fd8f4f07/ed4f9752-c9cf-4eb2-ac3e-f52cf443c4d3/post-login.png
- Screenshot · 2026-06-16T01:37:40.169Z · 309bf50b-527d-4e03-a89f-87c5fd8f4f07/5b9eb833-374b-4a63-8784-1a5851167281/milestone-goto-1.png
- Screenshot · 2026-06-16T01:37:40.166Z · 309bf50b-527d-4e03-a89f-87c5fd8f4f07/ed4f9752-c9cf-4eb2-ac3e-f52cf443c4d3/milestone-goto-1.png
- Trace · 2026-06-16T01:37:37.890Z · 309bf50b-527d-4e03-a89f-87c5fd8f4f07/2913b23e-2ce8-4d3d-9987-bff6f197779c/trace.zip
- Trace · 2026-06-16T01:37:37.230Z · 309bf50b-527d-4e03-a89f-87c5fd8f4f07/d6d32187-3167-43bc-b696-3fee04b21570/trace.zip
- Trace · 2026-06-16T01:37:37.094Z · 309bf50b-527d-4e03-a89f-87c5fd8f4f07/06d29ee9-5282-4b6e-8039-c45b654b91f0/trace.zip
- Screenshot · 2026-06-16T01:37:37.074Z · 309bf50b-527d-4e03-a89f-87c5fd8f4f07/2913b23e-2ce8-4d3d-9987-bff6f197779c/post-login.png
- Screenshot · 2026-06-16T01:37:36.379Z · 309bf50b-527d-4e03-a89f-87c5fd8f4f07/d6d32187-3167-43bc-b696-3fee04b21570/post-login.png
- Screenshot · 2026-06-16T01:37:35.913Z · 309bf50b-527d-4e03-a89f-87c5fd8f4f07/06d29ee9-5282-4b6e-8039-c45b654b91f0/post-login.png
- Additional artifacts not listed: 48

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

- Triage top console stack traces and fix front-end exceptions in critical paths.

## 11. Appendix: Event Summary

| Event Type | Count |
| --- | --- |
| action.completed | 120 |
| action.started | 120 |
| artifact.created | 60 |
| screenshot.captured | 40 |
| agent.completed | 20 |
| agent.logged_in | 20 |
| agent.started | 20 |
| console.error | 20 |
| workflow.completed | 20 |
| run.completed | 1 |
| run.started | 1 |
