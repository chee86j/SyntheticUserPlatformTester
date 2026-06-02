# Prediction Calibration

## Purpose

This phase adds the internal foundation for comparing synthetic workflow predictions against real-world beta or production-adjacent outcomes over time.

## What this is for

- Calibrating persona realism after repeated runs.
- Measuring whether synthetic task success trends align with actual user outcomes.
- Tracking where synthetic sessions are too optimistic or too pessimistic.
- Creating an internal feedback loop before external analytics integrations are added.

## Current scope

- Manual CSV import only.
- Internal schema for actual metrics and prediction accuracy snapshots.
- Dashboard comparison table showing synthetic versus actual values and gap percentages.
- Workflow-level calibration for:
  - task success rate
  - completion time
  - error rate
  - API calls per session
  - support-ticket volume

## Not included yet

- No Segment integration.
- No Mixpanel integration.
- No PostHog integration.
- No automatic ingestion from production telemetry.

## Important note on placeholders

Two synthetic metrics are currently internal calibration placeholders:

- Synthetic API calls per session
- Synthetic support-ticket estimate

These are derived from internal run behavior and findings so the comparison UI can exist before telemetry integrations ship. They should be treated as provisional calibration signals rather than authoritative production-equivalent measurements.

## Recommended workflow

1. Run a synthetic workflow to completion.
2. Import actual metrics for the same workflow and time window by pasting CSV into the dashboard.
3. Review the comparison table and gap percentages.
4. Adjust personas, workflow expectations, or interpretation of findings based on repeated mismatch patterns.
5. Repeat over time to improve persona accuracy and confidence in synthetic predictions.
