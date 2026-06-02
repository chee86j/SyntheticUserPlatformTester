import { AnthropicProvider } from "./anthropic-provider.js";
import { OpenAiProvider } from "./openai-provider.js";
import type { LlmProvider, ProviderConfig } from "./types.js";

export function createLlmProvider(config: ProviderConfig): LlmProvider {
  if (config.provider === "openai") return new OpenAiProvider(config);
  if (config.provider === "anthropic") return new AnthropicProvider(config);
  throw new Error(`Unsupported provider: ${config.provider}`);
}
