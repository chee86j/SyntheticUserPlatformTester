import type { LlmCompleteRequest, LlmProvider, LlmResponse, ProviderConfig } from "./types.js";

function safeJsonParse(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function estimateAnthropicCost(model: string, inputTokens?: number, outputTokens?: number): number | undefined {
  if (inputTokens === undefined && outputTokens === undefined) return undefined;
  const pricingPer1k = model.includes("opus")
    ? { in: 0.015, out: 0.075 }
    : { in: 0.003, out: 0.015 };
  const inCost = ((inputTokens ?? 0) / 1000) * pricingPer1k.in;
  const outCost = ((outputTokens ?? 0) / 1000) * pricingPer1k.out;
  return Number((inCost + outCost).toFixed(6));
}

export class AnthropicProvider implements LlmProvider {
  private readonly cfg: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.cfg = config;
  }

  async complete(request: LlmCompleteRequest): Promise<LlmResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? this.cfg.timeoutMs ?? 30000);

    try {
      const baseUrl = this.cfg.baseUrl ?? "https://api.anthropic.com/v1";
      const response = await fetch(`${baseUrl}/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.cfg.apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: this.cfg.model,
          max_tokens: request.maxTokens ?? 512,
          temperature: request.temperature ?? 0,
          system: request.system,
          messages: [{ role: "user", content: request.prompt }]
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Anthropic request failed (${response.status}): ${text.slice(0, 300)}`);
      }

      const payload = (await response.json()) as {
        id?: string;
        content?: Array<{ type?: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
        stop_reason?: string | null;
      };

      const text = payload.content?.find((item) => item.type === "text")?.text ?? "";
      const parsedJson = request.responseFormat === "json" ? safeJsonParse(text) : undefined;
      const inputTokens = payload.usage?.input_tokens;
      const outputTokens = payload.usage?.output_tokens;

      return {
        text,
        parsedJson,
        inputTokens,
        outputTokens,
        estimatedCost: estimateAnthropicCost(this.cfg.model, inputTokens, outputTokens),
        metadata: {
          provider: "anthropic",
          model: this.cfg.model,
          id: payload.id,
          stopReason: payload.stop_reason ?? null,
          usage: payload.usage ?? null
        }
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
