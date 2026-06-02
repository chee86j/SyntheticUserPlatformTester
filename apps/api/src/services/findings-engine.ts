import { EventSeverity, type SimulationAgent } from "@prisma/client";
import {
  ArtifactRepository,
  EventRepository,
  FindingRepository,
  LlmProviderConfigRepository,
  PersonaRepository,
  RunRepository
} from "@synthetic/database";
import { LlmGatewayService } from "./llm-gateway-service.js";

type RuleFinding = {
  type:
    | "UX_FRICTION"
    | "BUG"
    | "PERFORMANCE_ISSUE"
    | "ACCESSIBILITY_CONCERN"
    | "WORKFLOW_FAILURE"
    | "SECURITY_CONCERN"
    | "DATA_VALIDATION_ISSUE"
    | "CONFUSING_COPY";
  title: string;
  summary: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  confidence: number;
  affectedPersonas: string[];
  affectedWorkflow: string;
  evidenceEventIds: string[];
  recommendation: string;
  detail?: string;
};

export class FindingsEngine {
  private readonly runRepository = new RunRepository();
  private readonly eventRepository = new EventRepository();
  private readonly artifactRepository = new ArtifactRepository();
  private readonly personaRepository = new PersonaRepository();
  private readonly findingRepository = new FindingRepository();
  private readonly providerConfigRepository = new LlmProviderConfigRepository();
  private readonly llmGatewayService = new LlmGatewayService();

  async generateForRun(input: { runId: string; organizationId: string; userIdForBudget?: string }) {
    const run = await this.runRepository.getExecutionById(input.runId);
    if (!run || run.organizationId !== input.organizationId) return { findingsCreated: 0 };

    const events = await this.eventRepository.listByRunForOrganization(run.id, input.organizationId);
    const agents = await this.runRepository.listAgentsByRun(run.id);
    const artifacts = await this.artifactRepository.listByRunForOrganization(run.id, input.organizationId);
    const personas = await this.personaRepository.listByOrganization(input.organizationId);

    const selectedPersonas = personas.filter((p) => run.selectedPersonaIds.includes(p.id));

    let findings = this.analyzeRules({
      workflowName: run.workflow.name,
      workflowGoal: run.workflow.goal,
      successCriteria: run.workflow.successCriteria,
      events,
      agents,
      artifacts,
      personas: selectedPersonas
    });

    if (process.env.FINDINGS_USE_LLM === "true") {
      findings = await this.enrichWithOptionalLlm({
        findings,
        runId: run.id,
        organizationId: input.organizationId
      });
    }

    const created = await this.findingRepository.replaceForRun(
      run.id,
      findings.map((finding) => ({ ...finding, simulationRunId: run.id }))
    );

    return { findingsCreated: created.count };
  }

  analyzeRules(input: {
    workflowName: string;
    workflowGoal: string;
    successCriteria: unknown;
    events: Array<{
      id: string;
      eventType: string;
      severity: EventSeverity;
      payload: Record<string, unknown>;
      agentId: string | null;
      personaId: string | null;
    }>;
    agents: SimulationAgent[];
    artifacts: Array<{ id: string; type: string; uri: string }>;
    personas: Array<{ id: string; name: string; technicalProficiency: number }>;
  }): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const byType = (type: string) => input.events.filter((event) => event.eventType === type);

    const workflowFailed = byType("workflow.failed");
    if (workflowFailed.length > 0) {
      findings.push({
        type: "WORKFLOW_FAILURE",
        title: `Workflow failure detected in ${input.workflowName}`,
        summary: `${workflowFailed.length} workflow failure events were recorded against the run goal.` ,
        severity: workflowFailed.length >= 3 ? "HIGH" : "MEDIUM",
        confidence: 0.9,
        affectedPersonas: uniqueIds(workflowFailed.map((e) => e.personaId)),
        affectedWorkflow: input.workflowName,
        evidenceEventIds: workflowFailed.slice(0, 10).map((e) => e.id),
        recommendation: "Review failed workflow steps and improve task completion cues before rollout."
      });
    }

    const consoleErrors = byType("console.error");
    if (consoleErrors.length > 0) {
      findings.push({
        type: "BUG",
        title: "Console errors indicate runtime defects",
        summary: `${consoleErrors.length} console errors were emitted during simulation.` ,
        severity: consoleErrors.length >= 5 ? "HIGH" : "MEDIUM",
        confidence: 0.85,
        affectedPersonas: uniqueIds(consoleErrors.map((e) => e.personaId)),
        affectedWorkflow: input.workflowName,
        evidenceEventIds: consoleErrors.slice(0, 10).map((e) => e.id),
        recommendation: "Triage top console stack traces and fix front-end exceptions in critical paths."
      });
    }

    const networkFailed = byType("network.failed");
    if (networkFailed.length > 0) {
      findings.push({
        type: "PERFORMANCE_ISSUE",
        title: "Network instability impacted workflow reliability",
        summary: `${networkFailed.length} network failure events were observed.` ,
        severity: networkFailed.length >= 4 ? "HIGH" : "MEDIUM",
        confidence: 0.82,
        affectedPersonas: uniqueIds(networkFailed.map((e) => e.personaId)),
        affectedWorkflow: input.workflowName,
        evidenceEventIds: networkFailed.slice(0, 10).map((e) => e.id),
        recommendation: "Stabilize failing API calls and add resilient loading/error handling for transient failures."
      });
    }

    const actionFailures = byType("action.failed");
    if (actionFailures.length > 0) {
      const lowTechPersonas = new Set(
        input.personas.filter((persona) => persona.technicalProficiency <= 40).map((persona) => persona.id)
      );
      const lowTechFailures = actionFailures.filter((event) => event.personaId && lowTechPersonas.has(event.personaId));

      findings.push({
        type: lowTechFailures.length > 0 ? "UX_FRICTION" : "DATA_VALIDATION_ISSUE",
        title:
          lowTechFailures.length > 0
            ? "Low technical proficiency users encountered UX friction"
            : "Action failures indicate form or interaction validation gaps",
        summary:
          lowTechFailures.length > 0
            ? "Lower technical proficiency personas failed key actions more often, suggesting label/interaction clarity issues."
            : `${actionFailures.length} action failures indicate interaction or validation breakpoints.` ,
        severity: actionFailures.length >= 6 ? "HIGH" : "MEDIUM",
        confidence: lowTechFailures.length > 0 ? 0.78 : 0.74,
        affectedPersonas: uniqueIds(actionFailures.map((e) => e.personaId)),
        affectedWorkflow: input.workflowName,
        evidenceEventIds: actionFailures.slice(0, 12).map((e) => e.id),
        recommendation:
          lowTechFailures.length > 0
            ? "Use clearer labels and explicit guidance for critical actions, especially for novice users."
            : "Add stricter UI validation feedback and recoverable error states for failed actions."
      });
    }

    const frustrationEvents = input.events.filter((event) => {
      const score = Number((event.payload as Record<string, unknown>).frustrationScore ?? 0);
      return Number.isFinite(score) && score >= 70;
    });

    if (frustrationEvents.length > 0) {
      findings.push({
        type: "CONFUSING_COPY",
        title: "High frustration signals suggest confusing guidance or copy",
        summary: `${frustrationEvents.length} events reported high frustration scores.` ,
        severity: frustrationEvents.length >= 5 ? "HIGH" : "MEDIUM",
        confidence: 0.71,
        affectedPersonas: uniqueIds(frustrationEvents.map((e) => e.personaId)),
        affectedWorkflow: input.workflowName,
        evidenceEventIds: frustrationEvents.slice(0, 12).map((e) => e.id),
        recommendation: "Clarify labels/instructions and shorten ambiguous microcopy in critical steps."
      });
    }

    const screenshotArtifacts = input.artifacts.filter((artifact) => artifact.type === "SCREENSHOT");
    if (screenshotArtifacts.length > 0 && actionFailures.length > 0) {
      findings.push({
        type: "ACCESSIBILITY_CONCERN",
        title: "Failure screenshots suggest possible accessibility obstacles",
        summary: `${actionFailures.length} failures occurred with ${screenshotArtifacts.length} captured screenshots for review.` ,
        severity: "LOW",
        confidence: 0.52,
        affectedPersonas: uniqueIds(actionFailures.map((e) => e.personaId)),
        affectedWorkflow: input.workflowName,
        evidenceEventIds: actionFailures.slice(0, 8).map((e) => e.id),
        recommendation: "Audit focus order, control labels, and visible affordances in failed screens."
      });
    }

    const securityLike = input.events.filter((event) => {
      const payload = event.payload as Record<string, unknown>;
      const reason = String(payload.reason ?? payload.error ?? "").toLowerCase();
      return reason.includes("unauthorized") || reason.includes("forbidden") || reason.includes("csrf");
    });

    if (securityLike.length > 0) {
      findings.push({
        type: "SECURITY_CONCERN",
        title: "Security-related failures surfaced during run",
        summary: `${securityLike.length} events indicate potential auth/session/security handling issues.` ,
        severity: "HIGH",
        confidence: 0.76,
        affectedPersonas: uniqueIds(securityLike.map((e) => e.personaId)),
        affectedWorkflow: input.workflowName,
        evidenceEventIds: securityLike.slice(0, 10).map((e) => e.id),
        recommendation: "Review auth/session boundary behavior and harden error handling for restricted actions."
      });
    }

    return dedupeFindings(findings);
  }

  private async enrichWithOptionalLlm(input: {
    findings: RuleFinding[];
    runId: string;
    organizationId: string;
  }): Promise<RuleFinding[]> {
    if (input.findings.length === 0) return input.findings;

    const configs = await this.providerConfigRepository.listByOrganization(input.organizationId);
    const active = configs.find((config) => config.status === "active");
    if (!active) return input.findings;

    const prompt = `Rewrite the following finding summaries to be concise and actionable JSON array of strings only: ${JSON.stringify(input.findings.map((f) => f.summary))}`;

    try {
      const completion = await this.llmGatewayService.execute({
        organizationId: input.organizationId,
        runId: input.runId,
        providerConfigId: active.id,
        request: { prompt, responseFormat: "json", maxTokens: 500, temperature: 0.1 }
      });

      const parsed = Array.isArray(completion.response.parsedJson)
        ? completion.response.parsedJson
        : [];

      return input.findings.map((finding, index) => ({
        ...finding,
        summary: typeof parsed[index] === "string" ? parsed[index] : finding.summary
      }));
    } catch {
      return input.findings;
    }
  }
}

function uniqueIds(values: Array<string | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function dedupeFindings(findings: RuleFinding[]): RuleFinding[] {
  const seen = new Set<string>();
  const deduped: RuleFinding[] = [];
  for (const finding of findings) {
    const key = `${finding.type}:${finding.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(finding);
  }
  return deduped;
}
