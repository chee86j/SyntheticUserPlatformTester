import { context, metrics, propagation, trace, type Attributes, type Span, type SpanOptions } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ConsoleMetricExporter, MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

export type TelemetryInitInput = {
  serviceName: string;
  serviceVersion?: string;
  serviceNamespace?: string;
  enabled?: boolean;
  consoleExportEnabled?: boolean;
  metricExportIntervalMs?: number;
  resourceAttributes?: Attributes;
};

type TelemetryState = {
  tracerProvider: NodeTracerProvider | null;
  meterProvider: MeterProvider | null;
  initialized: boolean;
};

const telemetryState: TelemetryState = {
  tracerProvider: null,
  meterProvider: null,
  initialized: false
};

export function initializeTelemetry(input: TelemetryInitInput): void {
  if (telemetryState.initialized || input.enabled === false) {
    telemetryState.initialized = true;
    return;
  }

  const resource = resourceFromAttributes({
    "service.name": input.serviceName,
    ...(input.serviceVersion ? { "service.version": input.serviceVersion } : {}),
    ...(input.serviceNamespace ? { "service.namespace": input.serviceNamespace } : {}),
    ...(input.resourceAttributes ?? {})
  });

  const tracerProvider = new NodeTracerProvider({
    resource,
    spanProcessors: input.consoleExportEnabled
      ? [new BatchSpanProcessor(new ConsoleSpanExporter())]
      : []
  });
  tracerProvider.register({
    contextManager: new AsyncLocalStorageContextManager().enable(),
    propagator: new W3CTraceContextPropagator()
  });

  const readers = input.consoleExportEnabled
    ? [
        new PeriodicExportingMetricReader({
          exporter: new ConsoleMetricExporter(),
          exportIntervalMillis: input.metricExportIntervalMs ?? 5000
        })
      ]
    : [];

  const meterProvider = new MeterProvider({
    resource,
    readers
  });

  metrics.setGlobalMeterProvider(meterProvider);

  telemetryState.tracerProvider = tracerProvider;
  telemetryState.meterProvider = meterProvider;
  telemetryState.initialized = true;
}

export async function shutdownTelemetry(): Promise<void> {
  await Promise.allSettled([
    telemetryState.tracerProvider?.shutdown(),
    telemetryState.meterProvider?.shutdown()
  ]);
  telemetryState.initialized = false;
  telemetryState.tracerProvider = null;
  telemetryState.meterProvider = null;
}

export function getTracer(name: string) {
  return trace.getTracer(name);
}

export function getMeter(name: string) {
  return metrics.getMeter(name);
}

export function injectTraceHeaders(headers: Record<string, string>): Record<string, string> {
  propagation.inject(context.active(), headers);
  return headers;
}

export function getActiveTraceId(): string | null {
  return trace.getActiveSpan()?.spanContext().traceId ?? null;
}

export async function runWithSpan<T>(
  name: string,
  options: SpanOptions,
  callback: (span: Span) => Promise<T>
): Promise<T> {
  const tracer = getTracer("synthetic-platform");
  return tracer.startActiveSpan(name, options, async (span) => {
    try {
      return await callback(span);
    } catch (error) {
      span.recordException(error instanceof Error ? error : new Error("Unknown telemetry span error"));
      throw error;
    } finally {
      span.end();
    }
  });
}
