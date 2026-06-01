import { z } from "zod";

export const scriptedActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("goto"), url: z.string().min(1) }),
  z.object({ type: z.literal("click"), selector: z.string().min(1) }),
  z.object({ type: z.literal("fill"), selector: z.string().min(1), value: z.string() }),
  z.object({ type: z.literal("select"), selector: z.string().min(1), value: z.string() }),
  z.object({ type: z.literal("wait"), ms: z.number().int().min(0).max(60000) }),
  z.object({ type: z.literal("expectText"), text: z.string().min(1) }),
  z.object({ type: z.literal("screenshot"), name: z.string().min(1).max(120).optional() })
]);

export const scriptedWorkflowSchema = z.array(scriptedActionSchema).min(1).max(200);

export type ScriptedAction = z.infer<typeof scriptedActionSchema>;
