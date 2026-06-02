import { z } from "zod";

export const llmAllowedActionSchema = z.enum([
  "click",
  "type",
  "select",
  "scroll",
  "wait",
  "goBack",
  "finish",
  "fail"
]);

export const llmActionOutputSchema = z
  .object({
    action: llmAllowedActionSchema,
    target: z.string().trim().min(1).max(500),
    reason: z.string().trim().min(1).max(2000),
    confidence: z.number().min(0).max(1),
    frustrationDelta: z.number().int().min(-20).max(20)
  })
  .strict();

export type LlmAction = z.infer<typeof llmActionOutputSchema>;

type ParseInput = {
  text?: string;
  parsedJson?: unknown;
};

export class LlmActionParser {
  parse(input: ParseInput): LlmAction {
    const candidate = input.parsedJson ?? this.parseJsonText(input.text);
    return llmActionOutputSchema.parse(candidate);
  }

  private parseJsonText(raw?: string): unknown {
    if (!raw) {
      throw new Error("LLM response was empty");
    }

    const trimmed = raw.trim();
    try {
      return JSON.parse(trimmed);
    } catch {
      const first = trimmed.indexOf("{");
      const last = trimmed.lastIndexOf("}");
      if (first >= 0 && last > first) {
        return JSON.parse(trimmed.slice(first, last + 1));
      }
      throw new Error("LLM response was not valid JSON");
    }
  }
}
