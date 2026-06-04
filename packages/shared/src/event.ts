import { z } from "zod";

export const simulationEventTypeSchema = z.enum([
  "run.started",
  "run.completed",
  "run.failed",
  "run.cancelled",
  "agent.started",
  "agent.completed",
  "agent.failed",
  "agent.logged_in",
  "action.started",
  "action.completed",
  "action.failed",
  "console.error",
  "network.failed",
  "screenshot.captured",
  "artifact.created",
  "workflow.completed",
  "workflow.failed",
  "budget.exceeded"
]);

export const simulationEventSeveritySchema = z.enum(["INFO", "WARNING", "ERROR", "CRITICAL"]);

const primitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const payloadValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([primitiveSchema, z.array(payloadValueSchema), z.record(z.string(), payloadValueSchema)])
);

const eventPayloadByTypeSchema = z.object({
  "run.started": z.object({ trigger: z.enum(["manual", "scheduled"]).default("manual") }).passthrough(),
  "run.completed": z.object({ durationMs: z.number().int().nonnegative().optional() }).passthrough(),
  "run.failed": z.object({ reason: z.string().min(1).max(500) }).passthrough(),
  "run.cancelled": z.object({ reason: z.string().min(1).max(500).optional() }).passthrough(),
  "agent.started": z.object({ step: z.number().int().nonnegative().optional() }).passthrough(),
  "agent.completed": z.object({ stepCount: z.number().int().nonnegative().optional() }).passthrough(),
  "agent.failed": z.object({ reason: z.string().min(1).max(500) }).passthrough(),
  "agent.logged_in": z.object({ accountLabel: z.string().min(1).max(120).optional() }).passthrough(),
  "action.started": z.object({ action: z.string().min(1).max(200) }).passthrough(),
  "action.completed": z.object({ action: z.string().min(1).max(200) }).passthrough(),
  "action.failed": z.object({ action: z.string().min(1).max(200), error: z.string().min(1).max(1000) }).passthrough(),
  "console.error": z.object({ message: z.string().min(1).max(2000) }).passthrough(),
  "network.failed": z.object({ url: z.string().url(), status: z.number().int().optional() }).passthrough(),
  "screenshot.captured": z.object({ uri: z.string().min(1).max(2000) }).passthrough(),
  "artifact.created": z.object({ artifactId: z.string().uuid().optional(), type: z.string().min(1).max(120) }).passthrough(),
  "workflow.completed": z.object({ criteriaPassed: z.number().int().nonnegative().optional() }).passthrough(),
  "workflow.failed": z.object({ reason: z.string().min(1).max(500) }).passthrough(),
  "budget.exceeded": z.object({ limit: z.number().nonnegative(), current: z.number().nonnegative() }).passthrough()
});

export const simulationEventSchema = z
  .object({
    runId: z.string().uuid(),
    agentId: z.string().uuid().optional(),
    personaId: z.string().uuid().optional(),
    traceId: z.string().trim().regex(/^[0-9a-f]{32}$/i).optional(),
    eventType: simulationEventTypeSchema,
    severity: simulationEventSeveritySchema.default("INFO"),
    payload: z.record(z.string(), payloadValueSchema).default({}),
    timestamp: z.coerce.date().optional()
  })
  .superRefine((value, ctx) => {
    const payloadSchema = eventPayloadByTypeSchema.shape[value.eventType];
    const payloadResult = payloadSchema.safeParse(value.payload);
    if (!payloadResult.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid payload for event type ${value.eventType}`
      });
    }
  });

export type SimulationEventInput = z.infer<typeof simulationEventSchema>;
export type SimulationEventType = z.infer<typeof simulationEventTypeSchema>;
