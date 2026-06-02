import { RunnerApiClient } from "../lib/api-client.js";

export class AccountReservationService {
  constructor(private readonly api: RunnerApiClient) {}

  async reserve(input: { accountId: string; runId: string; agentId: string }): Promise<void> {
    await this.api.request(`/api/test-accounts/${input.accountId}/reserve`, {
      method: "POST",
      body: { runId: input.runId, agentId: input.agentId }
    });
  }

  async release(input: { accountId: string; runId: string; agentId: string }): Promise<void> {
    await this.api.request(`/api/test-accounts/${input.accountId}/release`, {
      method: "POST",
      body: { runId: input.runId, agentId: input.agentId }
    });
  }
}
