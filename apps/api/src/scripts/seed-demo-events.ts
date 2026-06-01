import { PrismaClient, RunStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function ensureRun() {
  const organization = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!organization) throw new Error("No organization found. Run prisma seed first.");

  const project = await prisma.project.findFirst({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "asc" }
  });
  const environment = await prisma.environment.findFirst({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "asc" }
  });
  const workflow = await prisma.workflow.findFirst({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "asc" }
  });
  const user = await prisma.user.findFirst({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "asc" }
  });

  if (!project || !environment || !workflow || !user) {
    throw new Error("Missing seeded project/environment/workflow/user records.");
  }

  const personas = await prisma.persona.findMany({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "asc" },
    take: 3
  });
  const accounts = await prisma.testAccount.findMany({
    where: { organizationId: organization.id, environmentId: environment.id },
    orderBy: { createdAt: "asc" },
    take: 3
  });
  const budgetPolicy = await prisma.budgetPolicy.findFirst({
    where: { organizationId: organization.id, isActive: true }
  });

  const latestRun = await prisma.simulationRun.findFirst({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "desc" }
  });

  if (latestRun) return latestRun;

  return prisma.simulationRun.create({
    data: {
      organizationId: organization.id,
      projectId: project.id,
      environmentId: environment.id,
      workflowId: workflow.id,
      budgetPolicyId: budgetPolicy?.id,
      personaId: personas[0]?.id ?? null,
      selectedPersonaIds: personas.map((persona) => persona.id),
      selectedTestAccountIds: accounts.map((account) => account.id),
      requestedAgentCount: Math.max(1, accounts.length),
      maxRunDurationSeconds: 600,
      createdByUserId: user.id,
      status: RunStatus.RUNNING,
      startedAt: new Date()
    }
  });
}

async function seedDemoEvents() {
  const run = await ensureRun();
  const orgId = run.organizationId;

  const existingAgents = await prisma.simulationAgent.findMany({
    where: { simulationRunId: run.id },
    orderBy: { createdAt: "asc" }
  });

  let agents = existingAgents;
  if (agents.length === 0) {
    const personas = await prisma.persona.findMany({
      where: { organizationId: orgId },
      take: 3,
      orderBy: { createdAt: "asc" }
    });
    await prisma.simulationAgent.createMany({
      data: personas.map((persona) => ({
        simulationRunId: run.id,
        personaId: persona.id,
        status: "RUNNING"
      }))
    });
    agents = await prisma.simulationAgent.findMany({
      where: { simulationRunId: run.id },
      orderBy: { createdAt: "asc" }
    });
  }

  const now = Date.now();
  const eventData = [
    { eventType: "run.started", severity: "INFO", offsetMs: -120000, payload: { demoMode: true, trigger: "manual" } },
    { eventType: "agent.started", severity: "INFO", offsetMs: -110000, agentIndex: 0, payload: { demoMode: true, step: 1 } },
    { eventType: "agent.logged_in", severity: "INFO", offsetMs: -105000, agentIndex: 0, payload: { demoMode: true, accountLabel: "Seed Account 01" } },
    { eventType: "action.started", severity: "INFO", offsetMs: -100000, agentIndex: 0, payload: { demoMode: true, action: "open_login_page" } },
    { eventType: "action.completed", severity: "INFO", offsetMs: -98000, agentIndex: 0, payload: { demoMode: true, action: "open_login_page", durationMs: 2000, llmCostUsd: 0.01, frustrationScore: 2 } },
    { eventType: "action.started", severity: "INFO", offsetMs: -92000, agentIndex: 1, payload: { demoMode: true, action: "submit_login_form" } },
    { eventType: "network.failed", severity: "WARNING", offsetMs: -89000, agentIndex: 1, payload: { demoMode: true, url: "https://staging.example.local/api/login", status: 503, frustrationScore: 6 } },
    { eventType: "action.failed", severity: "ERROR", offsetMs: -86000, agentIndex: 1, payload: { demoMode: true, action: "submit_login_form", error: "Service unavailable", llmCostUsd: 0.02, frustrationScore: 8 } },
    { eventType: "console.error", severity: "ERROR", offsetMs: -82000, agentIndex: 1, payload: { demoMode: true, message: "Unhandled auth error in login flow" } },
    { eventType: "agent.failed", severity: "ERROR", offsetMs: -78000, agentIndex: 1, payload: { demoMode: true, reason: "Unable to proceed after login failure", frustrationScore: 9 } },
    { eventType: "agent.started", severity: "INFO", offsetMs: -74000, agentIndex: 2, payload: { demoMode: true, step: 1 } },
    { eventType: "action.started", severity: "INFO", offsetMs: -70000, agentIndex: 2, payload: { demoMode: true, action: "navigate_dashboard" } },
    { eventType: "action.completed", severity: "INFO", offsetMs: -65000, agentIndex: 2, payload: { demoMode: true, action: "navigate_dashboard", durationMs: 5000, llmCostUsd: 0.03, frustrationScore: 3 } },
    { eventType: "screenshot.captured", severity: "INFO", offsetMs: -62000, agentIndex: 2, payload: { demoMode: true, uri: "demo://artifacts/screenshot-01.png" } },
    { eventType: "artifact.created", severity: "INFO", offsetMs: -60000, agentIndex: 2, payload: { demoMode: true, type: "SCREENSHOT" } },
    { eventType: "workflow.completed", severity: "INFO", offsetMs: -55000, agentIndex: 2, payload: { demoMode: true, durationMs: 19000, criteriaPassed: 3, llmCostUsd: 0.05, frustrationScore: 3 } },
    { eventType: "agent.completed", severity: "INFO", offsetMs: -52000, agentIndex: 2, payload: { demoMode: true, stepCount: 7 } },
    { eventType: "budget.exceeded", severity: "WARNING", offsetMs: -47000, payload: { demoMode: true, limit: 0.08, current: 0.11 } },
    { eventType: "workflow.failed", severity: "ERROR", offsetMs: -43000, agentIndex: 0, payload: { demoMode: true, reason: "Validation check timeout", frustrationScore: 7 } },
    { eventType: "run.failed", severity: "CRITICAL", offsetMs: -40000, payload: { demoMode: true, reason: "One or more workflow goals failed" } }
  ];

  const personas = await prisma.persona.findMany({
    where: { organizationId: orgId },
    take: 3,
    orderBy: { createdAt: "asc" }
  });

  await prisma.simulationEvent.createMany({
    data: eventData.map((event, index) => {
      const persona = personas[(event.agentIndex ?? index) % Math.max(1, personas.length)];
      const agent = event.agentIndex !== undefined ? agents[event.agentIndex % Math.max(1, agents.length)] : null;
      return {
        organizationId: orgId,
        runId: run.id,
        agentId: agent?.id ?? null,
        personaId: persona?.id ?? null,
        eventType: event.eventType,
        severity: event.severity as "INFO" | "WARNING" | "ERROR" | "CRITICAL",
        payload: event.payload,
        timestamp: new Date(now + event.offsetMs + index * 500)
      };
    })
  });

  console.log(`Demo events seeded for run ${run.id}`);
}

seedDemoEvents()
  .catch((error) => {
    console.error("Demo event seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
