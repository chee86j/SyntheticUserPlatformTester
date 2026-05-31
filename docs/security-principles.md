# Security Principles

## Security Position for MVP
The platform is designed for safe, controlled validation in test or staging environments, with strict boundaries around secrets, access, and execution behavior.

## Foundational Principles
- Least privilege by default across services, automation workers, and user roles.
- Explicit allow-listing of target domains and workflow entry points.
- No unrestricted shell, filesystem, or tool access for synthetic users.
- No authentication bypass in normal operation; use premade test accounts.
- Fail fast on unsafe config, missing credentials, or policy violations.

## Data and Secrets Handling
- Never log API keys, tokens, cookies, or test account passwords.
- Use environment-based secret injection and rotation-friendly config patterns.
- Redact sensitive fields in dashboards, logs, traces, and reports.
- Store only minimum required run metadata for diagnosis.

## Automation Guardrails
- Playwright sessions restricted to approved applications and paths.
- Session isolation per synthetic user to prevent cross-account leakage.
- Time and action limits per run to reduce abuse and runaway execution.
- Network failure and console error capture without exposing private payloads.

## Access and Auditability
- Role-based access for run launch and run review actions.
- Immutable run event timeline for traceability.
- Clear run attribution (who started it, what config was used, when it ran).

## Security Non-Goals in MVP
- Full SOC2 control implementation.
- Complete enterprise IAM integrations.
- Advanced threat detection and automated incident response.

These remain post-MVP roadmap items and should not block delivery of the first practical release.