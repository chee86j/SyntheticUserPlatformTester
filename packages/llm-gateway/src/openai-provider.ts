import type { LlmCompleteRequest, LlmProvider, LlmResponse, ProviderConfig } from "./types.js";

function safeJsonParse(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function estimateOpenAiCost(model: string, inputTokens?: number, outputTokens?: number): number | undefined {
  if (inputTokens === undefined && outputTokens === undefined) return undefined;

  // Conservative placeholder pricing map for MVP-level telemetry.
  const pricingPer1k = model.includes("gpt-4")
    ? { in: 0.01, out: 0.03 }
    : { in: 0.0005, out: 0.0015 };

  const inCost = ((inputTokens ?? 0) / 1000) * pricingPer1k.in;
  const outCost = ((outputTokens ?? 0) / 1000) * pricingPer1k.out;
  return Number((inCost + outCost).toFixed(6));
}

export class OpenAiProvider implements LlmProvider {
  private readonly cfg: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.cfg = config;
  }

  async complete(request: LlmCompleteRequest): Promise<LlmResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? this.cfg.timeoutMs ?? 30000);

    try {
      const baseUrl = this.cfg.baseUrl ?? "https://api.openai.com/v1";
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.cfg.apiKey}`
        },
        body: JSON.stringify({
          model: this.cfg.model,
          temperature: request.temperature ?? 0,
          max_tokens: request.maxTokens,
          response_format: request.responseFormat === "json" ? { type: "json_object" } : undefined,
          messages: [
            ...(request.system ? [{ role: "system", content: request.system }] : []),
            { role: "user", content: request.prompt }
          ]
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenAI request failed (${response.status}): ${text.slice(0, 300)}`);
      }

      const payload = (await response.json()) as {
        id?: string;
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };

      const text = payload.choices?.[0]?.message?.content ?? "";
      const parsedJson = request.responseFormat === "json" ? safeJsonParse(text) : undefined;
      const inputTokens = payload.usage?.prompt_tokens;
      const outputTokens = payload.usage?.completion_tokens;

      return {
        text,
        parsedJson,
        inputTokens,
        outputTokens,
        estimatedCost: estimateOpenAiCost(this.cfg.model, inputTokens, outputTokens),
        metadata: {
          provider: "openai",
          model: this.cfg.model,
          id: payload.id,
          usage: payload.usage ?? null
        }
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
