export type LlmCompleteRequest = {
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json";
  timeoutMs?: number;
};

export type LlmResponse = {
  text: string;
  parsedJson?: unknown;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: number;
  metadata: Record<string, unknown>;
};

export interface LlmProvider {
  complete(request: LlmCompleteRequest): Promise<LlmResponse>;
}

export type ProviderConfig = {
  provider: "openai" | "anthropic";
  model: string;
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
};
