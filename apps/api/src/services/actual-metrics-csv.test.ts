import assert from "node:assert/strict";
import test from "node:test";
import { parseActualMetricsCsv } from "./actual-metrics-csv.js";

test("parseActualMetricsCsv parses metric rows with quoted workflow names", () => {
  const rows = parseActualMetricsCsv(
    [
      "workflow_name,period_start,period_end,task_success_rate,completion_time_ms,error_rate,api_calls_per_session,support_ticket_count",
      '"Sign In and Dashboard",2026-06-01T00:00:00.000Z,2026-06-01T23:59:59.000Z,94.5,182000,5.5,6.2,3'
    ].join("\n")
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].workflowName, "Sign In and Dashboard");
  assert.equal(rows[0].taskSuccessRate, 94.5);
  assert.equal(rows[0].completionTimeMs, 182000);
});

test("parseActualMetricsCsv rejects missing headers", () => {
  assert.throws(
    () =>
      parseActualMetricsCsv(
        [
          "workflow_name,period_start,period_end,task_success_rate",
          '"Sign In and Dashboard",2026-06-01T00:00:00.000Z,2026-06-01T23:59:59.000Z,94.5'
        ].join("\n")
      ),
    /missing required header/i
  );
});
