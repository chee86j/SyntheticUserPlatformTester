# First Demo Scenario

## Demo Objective
Demonstrate that the platform can simulate realistic behavior across 20 synthetic users, surface failures in real time, and produce a clear markdown report for release decisions.

## Scenario Summary
Workflow: Authenticated sign-in and post-login task completion in a staging web application.

Synthetic users will:
- Receive premade test accounts.
- Execute persona-specific interaction patterns.
- Complete the same core business workflow with small behavioral variations.

## Demo Setup
- Target app: staging environment only.
- User count: 20 synthetic users.
- Accounts: 20 premade test credentials.
- Personas: at least 3 behavior profiles (fast, cautious, error-prone).
- Automation: Playwright-driven browser execution.
- Observability: real-time dashboard + event stream + markdown report.

## Demo Steps
1. Configure personas and account mapping.
2. Start run from dashboard.
3. Observe live metrics and per-user state transitions.
4. Trigger at least one known failure condition (example: temporary UI selector mismatch).
5. Confirm error surfaces in dashboard metrics and logs.
6. End run and generate markdown report.
7. Review report for pass/fail summary, failure distribution, and recommended next fix focus.

## Expected Outputs
- Live dashboard showing run progress, completions, and failures.
- Event metrics including completion rate, error categories, and duration stats.
- Markdown report suitable for internal release-readiness review.

## Demo Acceptance Criteria
- Run executes with 20 users without breaking control boundaries.
- At least one failure is detected and classified.
- Report is generated and readable by non-engineering stakeholders.
- Team can identify next engineering action from report findings.