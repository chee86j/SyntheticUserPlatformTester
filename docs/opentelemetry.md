# OpenTelemetry

## Purpose

Phase 27 adds vendor-neutral OpenTelemetry instrumentation so synthetic-user activity can be correlated with infrastructure performance without committing to any observability backend yet.

## What is instrumented

### API

- Request traces for HTTP traffic handled by the API
- `synthetic.api.latency`
- `synthetic.api.request.count`
- `synthetic.api.error.count`

### Queue and workers

- Producer spans when run and agent jobs are enqueued
- `synthetic.queue.duration`
- `synthetic.job.duration`

### Simulation events

- `traceId` is attached to stored simulation events
- This allows run events to be cross-referenced with backend traces later

## Current behavior

- Instrumentation is vendor-neutral
- No Datadog, Grafana, CloudWatch, or other backend integration is configured yet
- When console export is enabled locally, traces and metrics are emitted to stdout

## Environment flags

Both API and runner support:

- `OTEL_ENABLED=true`
- `OTEL_CONSOLE_EXPORT_ENABLED=true`
- `OTEL_METRIC_EXPORT_INTERVAL_MS=5000`

Recommended local test:

1. Start the API with OpenTelemetry enabled.
2. Start the runner worker with OpenTelemetry enabled if you want queue timing metrics too.
3. Hit `GET /health` or launch a run.
4. Confirm spans and metric exports appear in the process logs.

## Future backend wiring

This phase intentionally stops at SDK setup and local export. Later phases can connect the same instrumentation to:

- OTLP collectors
- self-hosted OpenTelemetry backends
- vendor platforms that support OTLP or OpenTelemetry SDK exporters

No application-level instrumentation should need to be rewritten for that handoff. The exporter configuration can be swapped while keeping the current spans, counters, and histograms.
