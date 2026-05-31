import { z } from "zod";

export const runSetupSchema = z.object({
  projectId: z.string().uuid(),
  environmentId: z.string().uuid(),
  workflowId: z.string().uuid(),
  personaIds: z.array(z.string().uuid()).min(1),
  agentCount: z.number().int().min(1).max(100),
  testAccountIds: z.array(z.string().uuid()).min(1),
  budgetPolicyId: z.string().uuid(),
  maxRunDurationSeconds: z.number().int().min(30).max(7200)
});

export type RunSetupInput = z.infer<typeof runSetupSchema>;
