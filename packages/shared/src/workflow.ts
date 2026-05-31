import { z } from "zod";

export const workflowTypeSchema = z.enum(["SCRIPTED", "GOAL_BASED", "EXPLORATORY"]);
export const workflowStatusSchema = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);

export const successCriteriaItemSchema = z.object({
  type: z.enum(["URL_CONTAINS", "PAGE_CONTAINS_TEXT", "ELEMENT_VISIBLE", "EVENT_EMITTED", "MANUAL_NOTE"]),
  value: z.string().trim().min(1).max(500)
});

export const workflowSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).default(""),
  goal: z.string().trim().min(1).max(1000),
  startingPath: z.string().trim().min(1).max(500),
  maxSteps: z.number().int().min(1).max(1000),
  maxDurationSeconds: z.number().int().min(1).max(7200),
  successCriteria: z.array(successCriteriaItemSchema).min(1).max(20),
  workflowType: workflowTypeSchema,
  status: workflowStatusSchema.default("DRAFT")
});

export const workflowCreateSchema = workflowSchema;
export const workflowUpdateSchema = workflowSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required"
);

export type WorkflowInput = z.infer<typeof workflowSchema>;
export type WorkflowCreateInput = z.infer<typeof workflowCreateSchema>;
export type WorkflowUpdateInput = z.infer<typeof workflowUpdateSchema>;
export type SuccessCriteriaItem = z.infer<typeof successCriteriaItemSchema>;
