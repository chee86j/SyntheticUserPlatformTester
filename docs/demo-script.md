# Demo Script

## Goal

Show a stable MVP flow from login to completed synthetic-user report without introducing new setup during the presentation.

## Before the demo

1. Start the stack:
   - `npm run dev -w @synthetic/api`
   - `npm run start:worker -w @synthetic/runner`
   - `npm run dev -w @synthetic/web`
2. Verify the seeded login works:
   - `admin@syntheticlabs.local`
   - `ChangeMe123!`
3. Make sure the target app is reachable and the worker is idle.
4. Keep the dashboard open to `Run Setup`.

## Live flow

1. Log into the dashboard.
   - Narration: "The dashboard is scoped to the authenticated organization and starts from a clean operator workflow."
2. Select the project and environment.
   - Narration: "The demo keeps the operator focused on valid project and environment combinations."
3. Select the active workflow.
   - Narration: "Workflows are chosen before launch so the run configuration is explicit."
4. Start the `20-agent demo preset`.
   - Narration: "This preset uses the existing seeded accounts and personas without adding new feature complexity."
5. Open the live run page as soon as the redirect lands.
   - Narration: "The dashboard updates live with run status, agent progress, event distribution, and artifact creation."
6. Click into an individual agent row.
   - Narration: "We can drill into one synthetic user to inspect recent activity and captured artifacts."
7. Open the artifacts section.
   - Narration: "Each agent produces execution evidence such as screenshots, traces, and video when enabled."
8. Open the markdown report when the run completes.
   - Narration: "The final report is stored as an artifact and is safe to share internally because sensitive values are redacted."

## What to point out

- Loading, empty, and error states are explicit across login, run setup, and live run views.
- Cancel actions require confirmation before interrupting a run.
- The run detail page surfaces metrics, recent errors, artifacts, findings, and per-agent activity in one layout.
- Event payloads and report content are redacted to avoid leaking passwords, cookies, or API keys.

## Expected outcome

- `20/20` agents complete.
- A `REPORT` artifact appears on the run detail page.
- Test accounts return to `AVAILABLE`.
- The live event feed remains readable even during the busiest part of the run.

## If something goes wrong

1. If the dashboard shows an API error, reload once and confirm the API and worker are still running.
2. If a run appears stalled, check for duplicate local worker processes before retrying.
3. If the report link does not appear, confirm the worker completed the report job and that the artifact list includes `REPORT`.
