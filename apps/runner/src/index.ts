import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EventSeverity, RunStatus } from "@prisma/client";
import {
  RunRepository,
  TestAccountRepository,
  disconnectDatabaseClient
} from "@synthetic/database";
import { env } from "./lib/config.js";
import { RunnerApiClient } from "./lib/api-client.js";
import { buildScript } from "./lib/script-builder.js";
import { executeScriptedWorkflow } from "./lib/playwright-runner.js";
import { decryptSecret } from "./lib/secrets.js";

const runRepository = new RunRepository();
const testAccountRepository = new TestAccountRepository();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const runId = env.RUN_ID;
  if (!runId) throw new Error("RUN_ID is required for runner execution");

  const api = new RunnerApiClient();
  await api.login();

  const run = await runRepository.getExecutionById(runId);
  if (!run) throw new Error(`Run ${runId} not found`);

  if (run.selectedTestAccountIds.length < 1) {
    throw new Error("Run has no selected test accounts");
  }

  const selectedAccounts = await testAccountRepository.listByIdsForOrganization(
    run.selectedTestAccountIds,
    run.organizationId
  );
  const account = selectedAccounts[0];

  if (!account) throw new Error("Unable to load selected test account");

  const password = resolveAccountPassword(account.encryptedPassword, account.passwordSecretRef);
  const personaId = run.selectedPersonaIds[0];

  const agent = await runRepository.createAgent({
    simulationRunId: run.id,
    personaId,
    testAccountId: account.id
  });

  const emit = async (input: {
    eventType:
      | "run.started"
      | "run.completed"
      | "run.failed"
      | "agent.started"
      | "agent.completed"
      | "agent.failed"
      | "agent.logged_in"
      | "action.started"
      | "action.completed"
      | "action.failed"
      | "console.error"
      | "network.failed"
      | "screenshot.captured"
      | "artifact.created"
      | "workflow.completed"
      | "workflow.failed";
    severity?: EventSeverity;
    payload: Record<string, unknown>;
  }) => {
    await api.request<{ event: { id: string } }>("/api/events", {
      method: "POST",
      body: {
        runId: run.id,
        agentId: agent.id,
        personaId,
        eventType: input.eventType,
        severity: input.severity ?? "INFO",
        payload: input.payload
      }
    });
  };

  const reservation = await api.request<{ success: boolean }>(`/api/test-accounts/${account.id}/reserve`, {
    method: "POST",
    body: { runId: run.id, agentId: agent.id }
  });

  if (!reservation.success) {
    throw new Error("Test account reservation failed");
  }

  const screenshotsDir = path.join(__dirname, "..", "screenshots", run.id, agent.id);
  await mkdir(screenshotsDir, { recursive: true });

  try {
    await runRepository.updateStatus(run.id, RunStatus.RUNNING);
    await emit({ eventType: "run.started", payload: { runner: "playwright-scripted" } });
    await emit({ eventType: "agent.started", payload: { accountLabel: account.label } });
    await emit({ eventType: "agent.logged_in", payload: { accountLabel: account.label } });

    const actions = buildScript(
      {
        startingPath: run.workflow.startingPath,
        successCriteria: run.workflow.successCriteria
      },
      run.environment.baseUrl,
      { username: account.username, password }
    );

    await executeScriptedWorkflow({
      actions,
      screenshotsDir,
      emit: (payload) => emit({ ...payload, severity: payload.severity as EventSeverity | undefined })
    });

    await runRepository.updateAgentStatus(agent.id, "COMPLETED", { finishedAt: new Date() });
    await emit({ eventType: "workflow.completed", payload: { actions: actions.length } });
    await emit({ eventType: "agent.completed", payload: { actions: actions.length } });
    await emit({ eventType: "run.completed", payload: { actions: actions.length } });

    const hasOtherActiveAgents = false;
    if (!hasOtherActiveAgents) {
      await runRepository.updateStatus(run.id, RunStatus.COMPLETED);
    }

    console.log(`[runner] run=${run.id} agent=${agent.id} completed`);
  } catch (error) {
    await runRepository.updateAgentStatus(agent.id, "FAILED", { finishedAt: new Date() });
    await runRepository.updateStatus(run.id, RunStatus.FAILED);

    const message = error instanceof Error ? error.message : "Unknown runner error";
    await emit({ eventType: "workflow.failed", severity: EventSeverity.ERROR, payload: { reason: message } });
    await emit({ eventType: "agent.failed", severity: EventSeverity.ERROR, payload: { reason: message } });
    await emit({ eventType: "run.failed", severity: EventSeverity.CRITICAL, payload: { reason: message } });

    console.error(`[runner] run=${run.id} agent=${agent.id} failed: ${message}`);
    throw error;
  } finally {
    await api.request(`/api/test-accounts/${account.id}/release`, {
      method: "POST",
      body: { runId: run.id, agentId: agent.id }
    }).catch((releaseError) => {
      const message = releaseError instanceof Error ? releaseError.message : "release failed";
      console.error(`[runner] failed to release test account: ${message}`);
    });

    await disconnectDatabaseClient();
  }
}

function resolveAccountPassword(encryptedPassword: string | null, secretRef: string | null): string {
  if (encryptedPassword) {
    return decryptSecret(encryptedPassword);
  }

  if (secretRef) {
    return env.RUNNER_DEFAULT_PASSWORD;
  }

  return env.RUNNER_DEFAULT_PASSWORD;
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`[runner] fatal: ${message}`);
  process.exit(1);
});
