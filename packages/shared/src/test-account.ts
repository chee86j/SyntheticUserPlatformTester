import { z } from "zod";

export const testAccountStatusSchema = z.enum(["AVAILABLE", "RESERVED", "DISABLED"]);

export const testAccountSchema = z.object({
  environmentId: z.string().uuid(),
  label: z.string().trim().min(1).max(120),
  username: z.string().trim().min(1).max(120),
  email: z.string().email(),
  role: z.string().trim().min(1).max(120),
  passwordSecretRef: z.string().trim().min(1).max(255).optional(),
  encryptedPassword: z.string().trim().min(1).max(4096).optional(),
  allowConcurrentUse: z.boolean().default(false),
  status: testAccountStatusSchema.default("AVAILABLE"),
  notes: z.string().trim().max(2000).default("")
});

export const testAccountCreateSchema = testAccountSchema.refine(
  (value) => Boolean(value.passwordSecretRef) || Boolean(value.encryptedPassword),
  {
    message: "Either passwordSecretRef or encryptedPassword is required"
  }
);

export const testAccountUpdateSchema = testAccountSchema.partial();

export type TestAccountInput = z.infer<typeof testAccountSchema>;
export type TestAccountCreateInput = z.infer<typeof testAccountCreateSchema>;
export type TestAccountUpdateInput = z.infer<typeof testAccountUpdateSchema>;
