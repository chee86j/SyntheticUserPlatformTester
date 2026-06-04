import { env } from "./config.js";
import cookieParser from "cookie-parser";
import express from "express";
import { createServer } from "node:http";
import { context, trace, SpanStatusCode } from "@opentelemetry/api";
import { getMeter, getTracer, initializeTelemetry, shutdownTelemetry } from "@synthetic/telemetry";
import { authRouter } from "./routes/auth.js";
import { protectedRouter } from "./routes/protected.js";
import { initializeRealtime } from "./realtime/socket.js";

initializeTelemetry({
  serviceName: "synthetic-api",
  serviceVersion: "0.1.0",
  serviceNamespace: "synthetic-platform",
  enabled: env.OTEL_ENABLED,
  consoleExportEnabled: env.OTEL_CONSOLE_EXPORT_ENABLED,
  metricExportIntervalMs: env.OTEL_METRIC_EXPORT_INTERVAL_MS
});

const app = express();
const tracer = getTracer("synthetic.api.http");
const meter = getMeter("synthetic.api.http");
const apiLatencyMs = meter.createHistogram("synthetic.api.latency", {
  description: "API request latency",
  unit: "ms"
});
const apiRequestCount = meter.createCounter("synthetic.api.request.count", {
  description: "Total API request count"
});
const apiErrorCount = meter.createCounter("synthetic.api.error.count", {
  description: "Total API error responses"
});

app.use((req, res, next) => {
  const startTime = Date.now();
  const spanName = `${req.method} ${req.path}`;
  const span = tracer.startSpan(spanName, {
    attributes: {
      "http.method": req.method,
      "http.route": req.path,
      "http.target": req.originalUrl
    }
  });

  const spanContext = trace.setSpan(context.active(), span);
  res.setHeader("x-trace-id", span.spanContext().traceId);

  res.on("finish", () => {
    const durationMs = Date.now() - startTime;
    const attributes = {
      "http.method": req.method,
      "http.route": req.route?.path ? String(req.route.path) : req.path,
      "http.status_code": res.statusCode
    };

    apiLatencyMs.record(durationMs, attributes);
    apiRequestCount.add(1, attributes);
    if (res.statusCode >= 400) {
      apiErrorCount.add(1, attributes);
      span.setStatus({ code: SpanStatusCode.ERROR });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }
    span.setAttribute("http.status_code", res.statusCode);
    span.end();
  });

  context.with(spanContext, next);
});

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", env.WEB_ORIGIN);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV
  });
});

app.use("/auth", authRouter);
app.use("/api", protectedRouter);

const server = createServer(app);
initializeRealtime(server);

server.listen(env.API_PORT, () => {
  console.log(`API listening on http://localhost:${env.API_PORT}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void shutdownTelemetry().finally(() => process.exit(0));
  });
}
