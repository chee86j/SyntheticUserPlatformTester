import { z } from "zod";

const scoreSchema = z.number().int().min(0).max(100);

export const personaSchema = z.object({
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(120),
  industry: z.string().trim().min(1).max(120),
  technicalProficiency: scoreSchema,
  domainExpertise: scoreSchema,
  timePressure: scoreSchema,
  patience: scoreSchema,
  confidence: scoreSchema,
  errorRecovery: scoreSchema,
  riskTolerance: scoreSchema,
  accessibilityNeeds: z.array(z.string().trim().min(1).max(120)).default([]),
  behaviorNotes: z.string().trim().max(2000).default("")
});

export const personaCreateSchema = personaSchema;

export const personaUpdateSchema = personaSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required"
);

export type PersonaInput = z.infer<typeof personaSchema>;
export type PersonaCreateInput = z.infer<typeof personaCreateSchema>;
export type PersonaUpdateInput = z.infer<typeof personaUpdateSchema>;
