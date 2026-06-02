type ParsedRow = Record<string, string>;

export type ActualMetricsCsvRow = {
  rowNumber: number;
  workflowName: string;
  periodStart: Date;
  periodEnd: Date;
  taskSuccessRate: number;
  completionTimeMs: number;
  errorRate: number;
  apiCallsPerSession: number;
  supportTicketCount: number;
};

const REQUIRED_HEADERS = [
  "workflow_name",
  "period_start",
  "period_end",
  "task_success_rate",
  "completion_time_ms",
  "error_rate",
  "api_calls_per_session",
  "support_ticket_count"
] as const;

export function parseActualMetricsCsv(input: string): ActualMetricsCsvRow[] {
  const lines = input
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one data row");
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  for (const required of REQUIRED_HEADERS) {
    if (!headers.includes(required)) {
      throw new Error(`CSV is missing required header: ${required}`);
    }
  }

  return lines.slice(1).map((line, index) => parseRow(toRow(headers, parseCsvLine(line)), index + 2));
}

function toRow(headers: string[], values: string[]): ParsedRow {
  const row: ParsedRow = {};
  headers.forEach((header, index) => {
    row[header] = values[index]?.trim() ?? "";
  });
  return row;
}

function parseRow(row: ParsedRow, rowNumber: number): ActualMetricsCsvRow {
  const workflowName = row.workflow_name?.trim();
  if (!workflowName) {
    throw new Error(`Row ${rowNumber}: workflow_name is required`);
  }

  const periodStart = parseDate(row.period_start, rowNumber, "period_start");
  const periodEnd = parseDate(row.period_end, rowNumber, "period_end");
  if (periodEnd < periodStart) {
    throw new Error(`Row ${rowNumber}: period_end must be on or after period_start`);
  }

  return {
    rowNumber,
    workflowName,
    periodStart,
    periodEnd,
    taskSuccessRate: parseNumber(row.task_success_rate, rowNumber, "task_success_rate", 0, 100),
    completionTimeMs: Math.round(parseNumber(row.completion_time_ms, rowNumber, "completion_time_ms", 0)),
    errorRate: parseNumber(row.error_rate, rowNumber, "error_rate", 0, 100),
    apiCallsPerSession: parseNumber(row.api_calls_per_session, rowNumber, "api_calls_per_session", 0),
    supportTicketCount: Math.round(parseNumber(row.support_ticket_count, rowNumber, "support_ticket_count", 0))
  };
}

function parseDate(value: string, rowNumber: number, field: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Row ${rowNumber}: ${field} must be a valid ISO date`);
  }
  return parsed;
}

function parseNumber(value: string, rowNumber: number, field: string, min: number, max = Number.POSITIVE_INFINITY): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Row ${rowNumber}: ${field} must be numeric`);
  }
  if (parsed < min || parsed > max) {
    throw new Error(`Row ${rowNumber}: ${field} must be between ${min} and ${max}`);
  }
  return parsed;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      const nextCharacter = line[index + 1];
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
}
