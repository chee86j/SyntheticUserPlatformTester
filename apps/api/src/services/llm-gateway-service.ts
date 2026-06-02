import { RunStatus } from "@prisma/client";
import { BudgetPolicyRepository, EventRepository, LlmProviderConfigRepository, LlmUsageRepository, RunRepository } from "@synthetic/database";
import { createLlmProvider, type LlmCompleteRequest } from "@synthetic/llm-gateway";
import { decryptSecret } from "../auth/secret-encryption.js";
import { emitRunEvent } from "../realtime/socket.js";
import { estimateConservativeCostUsd, isBudgetExceeded } from "./budget-utils.js";

type ExecuteLlmInput = {
  organizationId: string;
  runId: string;
  agentId?: string;
  providerConfigId: string;
  request: LlmCompleteRequest;
};

function getUtcDayRange(now: Date): { dayStart: Date; dayEnd: Date } {
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  return { dayStart, dayEnd };
}

export class LlmGatewayService {
  private readonly runRepository = new RunRepository();
  private readonly budgetPolicyRepository = new BudgetPolicyRepository();
  private readonly llmProviderConfigRepository = new LlmProviderConfigRepository();
  private readonly llmUsageRepository = new LlmUsageRepository();
  private readonly eventRepository = new EventRepository();

  async execute(input: ExecuteLlmInput) {
    const run = await this.runRepository.getById(input.runId);
    if (!run || run.organizationId !== input.organizationId) {
      throw new Error("Run not found");
    }

    const providerConfig = await this.llmProviderConfigRepository.findByIdForOrganization(
      input.providerConfigId,
      input.organizationId
    );
    if (!providerConfig || !providerConfig.isActive) {
      throw new Error("LLM provider config not found");
    }

    const budgetPolicy = run.budgetPolicyId
      ? await this.budgetPolicyRepository.findByIdForOrganization(run.budgetPolicyId, input.organizationId)
      : null;

    const currentUsage = await this.llmUsageRepository.getRunUsageTotals(run.id, input.organizationId);
    const maxTokensRequested = input.request.maxTokens ?? 1000;

    if (budgetPolicy?.maxTokensPerRun && currentUsage.totalTokens + maxTokensRequested > budgetPolicy.maxTokensPerRun) {
      await this.handleBudgetExceeded({
        runId: run.id,
        organizationId: input.organizationId,
        reason: "maxTokensPerRun",
        limit: budgetPolicy.maxTokensPerRun,
        current: currentUsage.totalTokens + maxTokensRequested,
        stopOnBudgetExceeded: budgetPolicy.stopOnBudgetExceeded
      });
      throw new Error("Budget exceeded before LLM call (token limit)");
    }

    if (
      budgetPolicy?.maxDurationPerRunSeconds &&
      run.startedAt &&
      Date.now() - run.startedAt.getTime() > budgetPolicy.maxDurationPerRunSeconds * 1000
    ) {
      await this.handleBudgetExceeded({
        runId: run.id,
        organizationId: input.organizationId,
        reason: "maxDurationPerRunSeconds",
        limit: budgetPolicy.maxDurationPerRunSeconds,
        current: Math.floor((Date.now() - run.startedAt.getTime()) / 1000),
        stopOnBudgetExceeded: budgetPolicy.stopOnBudgetExceeded
      });
      throw new Error("Budget exceeded before LLM call (duration limit)");
    }

    if (budgetPolicy?.maxActionsPerAgent && input.agentId) {
      const count = await this.llmUsageRepository.countByRunAndAgent(run.id, input.organizationId, input.agentId);
      if (count >= budgetPolicy.maxActionsPerAgent) {
        await this.handleBudgetExceeded({
          runId: run.id,
          organizationId: input.organizationId,
          reason: "maxActionsPerAgent",
          limit: budgetPolicy.maxActionsPerAgent,
          current: count + 1,
          stopOnBudgetExceeded: budgetPolicy.stopOnBudgetExceeded
        });
        throw new Error("Budget exceeded before LLM call (action limit)");
      }
    }

    const provider = createLlmProvider({
      provider: providerConfig.provider as "openai" | "anthropic",
      model: providerConfig.model,
      apiKey: decryptSecret(providerConfig.encryptedApiKey),
      baseUrl: providerConfig.baseUrl ?? undefined,
      timeoutMs: providerConfig.timeoutMs ?? undefined
    });

    const response = await provider.complete(input.request);

    const inputTokens = response.inputTokens ?? 0;
    const outputTokens = response.outputTokens ?? 0;
    const totalTokens = inputTokens + outputTokens;
    const estimatedCostUsd = estimateConservativeCostUsd({
      inputTokens,
      outputTokens,
      estimatedCostUsd: response.estimatedCost,
      requestedMaxTokens: maxTokensRequested
    });

    const persisted = await this.llmUsageRepository.create({
      organizationId: input.organizationId,
      runId: run.id,
      agentId: input.agentId,
      provider: providerConfig.provider,
      model: providerConfig.model,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCostUsd
    });

    const updatedUsage = await this.llmUsageRepository.getRunUsageTotals(run.id, input.organizationId);

    if (budgetPolicy) {
      const now = new Date();
      const { dayStart, dayEnd } = getUtcDayRange(now);
      const dailyCost = await this.llmUsageRepository.getDailyCostTotal(input.organizationId, dayStart, dayEnd);
      const evaluation = isBudgetExceeded({
        currentRunCostUsd: updatedUsage.estimatedCostUsd,
        currentRunTokens: updatedUsage.totalTokens,
        currentDailyCostUsd: dailyCost,
        maxCostPerRun: budgetPolicy.maxCostPerRun == null ? null : Number(budgetPolicy.maxCostPerRun),
        maxTokensPerRun: budgetPolicy.maxTokensPerRun,
        maxDailyCost: budgetPolicy.maxDailyCost == null ? null : Number(budgetPolicy.maxDailyCost)
      });
      if (evaluation.exceeded) {
        await this.handleBudgetExceeded({
          runId: run.id,
          organizationId: input.organizationId,
          reason: evaluation.reason,
          limit: evaluation.limit,
          current: evaluation.current,
          stopOnBudgetExceeded: budgetPolicy.stopOnBudgetExceeded
        });
      }
    }

    return {
      response,
      usage: {
        id: persisted.id,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCostUsd
      },
      totals: updatedUsage
    };
  }

  async getRunBudgetSummary(runId: string, organizationId: string) {
    const run = await this.runRepository.getById(runId);
    if (!run || run.organizationId !== organizationId) return null;

    const policy = run.budgetPolicyId
      ? await this.budgetPolicyRepository.findByIdForOrganization(run.budgetPolicyId, organizationId)
      : null;
    const totals = await this.llmUsageRepository.getRunUsageTotals(runId, organizationId);

    const remainingCost = policy?.maxCostPerRun == null ? null : Number(policy.maxCostPerRun) - totals.estimatedCostUsd;
    const remainingTokens = policy?.maxTokensPerRun == null ? null : policy.maxTokensPerRun - totals.totalTokens;
    const avgCostPerToken = totals.totalTokens > 0 ? totals.estimatedCostUsd / totals.totalTokens : null;
    const projectedNext1kTokenCost = avgCostPerToken == null ? null : avgCostPerToken * 1000;

    return {
      runId,
      policy: policy
        ? {
            id: policy.id,
            name: policy.name,
            maxCostPerRun: policy.maxCostPerRun == null ? null : Number(policy.maxCostPerRun),
            maxTokensPerRun: policy.maxTokensPerRun,
            maxActionsPerAgent: policy.maxActionsPerAgent,
            maxDurationPerRunSeconds: policy.maxDurationPerRunSeconds,
            maxDailyCost: policy.maxDailyCost == null ? null : Number(policy.maxDailyCost),
            stopOnBudgetExceeded: policy.stopOnBudgetExceeded
          }
        : null,
      totals,
      remaining: {
        cost: remainingCost,
        tokens: remainingTokens
      },
      projected: {
        next1000TokensCost: projectedNext1kTokenCost
      }
    };
  }

  private async handleBudgetExceeded(input: {
    runId: string;
    organizationId: string;
    reason: string;
    limit: number;
    current: number;
    stopOnBudgetExceeded: boolean;
  }) {
    const event = await this.eventRepository.create({
      organizationId: input.organizationId,
      runId: input.runId,
      eventType: "budget.exceeded",
      severity: "WARNING",
      payload: {
        reason: input.reason,
        limit: input.limit,
        current: input.current,
        stopOnBudgetExceeded: input.stopOnBudgetExceeded
      }
    });
    emitRunEvent(input.runId, event);

    if (input.stopOnBudgetExceeded) {
      await this.runRepository.updateStatus(input.runId, RunStatus.FAILED);
      const failedEvent = await this.eventRepository.create({
        organizationId: input.organizationId,
        runId: input.runId,
        eventType: "run.failed",
        severity: "CRITICAL",
        payload: { reason: "Budget exceeded", budgetReason: input.reason }
      });
      emitRunEvent(input.runId, failedEvent);
    }
  }
}
