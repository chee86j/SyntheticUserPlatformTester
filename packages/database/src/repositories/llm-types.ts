export type LlmProviderConfigCreateInput = {
  organizationId: string;
  provider: "openai" | "anthropic";
  model: string;
  encryptedApiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  status?: "inactive" | "active" | "error";
  isActive?: boolean;
};

export type LlmProviderConfigUpdateInput = Partial<{
  provider: "openai" | "anthropic";
  model: string;
  encryptedApiKey: string;
  baseUrl: string | null;
  timeoutMs: number;
  status: "inactive" | "active" | "error";
  lastCheckedAt: Date | null;
  lastError: string | null;
  isActive: boolean;
}>;
