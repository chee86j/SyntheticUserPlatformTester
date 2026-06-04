import assert from "node:assert/strict";
import test from "node:test";
import { getActiveTraceId, injectTraceHeaders, initializeTelemetry, runWithSpan, shutdownTelemetry } from "./index.js";

test("injectTraceHeaders writes W3C trace headers inside an active span", async () => {
  initializeTelemetry({ serviceName: "telemetry-test", enabled: true, consoleExportEnabled: false });

  try {
    await runWithSpan("test-span", {}, async () => {
      const headers = injectTraceHeaders({});
      assert.equal(typeof headers.traceparent, "string");
      assert.equal(getActiveTraceId()?.length, 32);
    });
  } finally {
    await shutdownTelemetry();
  }
});
