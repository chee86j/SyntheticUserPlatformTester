import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const organization = await prisma.organization.create({
    data: {
      name: "Synthetic Labs"
    }
  });

  const adminPassword = "ChangeMe123!";
  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);

  const adminUser = await prisma.user.create({
    data: {
      organizationId: organization.id,
      email: "admin@syntheticlabs.local",
      name: "Platform Owner",
      role: "OWNER",
      passwordHash: adminPasswordHash
    }
  });

  const project = await prisma.project.create({
    data: {
      organizationId: organization.id,
      name: "Core Validation"
    }
  });

  const environment = await prisma.environment.create({
    data: {
      organizationId: organization.id,
      projectId: project.id,
      name: "staging",
      baseUrl: "https://staging.example.local",
      type: "STAGING",
      allowedDomains: ["staging.example.local"],
      status: "ACTIVE"
    }
  });

  const personas = [
    {
      name: "Clinical Specialist",
      role: "Nurse Practitioner",
      industry: "Healthcare",
      technicalProficiency: 42,
      domainExpertise: 92,
      timePressure: 78,
      patience: 36,
      confidence: 44,
      errorRecovery: 61,
      riskTolerance: 29,
      accessibilityNeeds: ["high-contrast text"],
      behaviorNotes: "Reads labels carefully and expects explicit feedback before continuing."
    },
    {
      name: "Operations Lead",
      role: "Operations Manager",
      industry: "Logistics",
      technicalProficiency: 67,
      domainExpertise: 74,
      timePressure: 88,
      patience: 41,
      confidence: 69,
      errorRecovery: 72,
      riskTolerance: 55,
      accessibilityNeeds: [],
      behaviorNotes: "Prefers direct paths and abandons workflows that require repeated backtracking."
    },
    {
      name: "Compliance Reviewer",
      role: "Audit Analyst",
      industry: "Financial Services",
      technicalProficiency: 58,
      domainExpertise: 83,
      timePressure: 35,
      patience: 79,
      confidence: 63,
      errorRecovery: 76,
      riskTolerance: 18,
      accessibilityNeeds: ["reduced-motion"],
      behaviorNotes: "Validates wording and consistency thoroughly and flags ambiguous actions."
    },
    {
      name: "Support Agent",
      role: "Customer Support Specialist",
      industry: "SaaS",
      technicalProficiency: 72,
      domainExpertise: 57,
      timePressure: 64,
      patience: 68,
      confidence: 66,
      errorRecovery: 81,
      riskTolerance: 49,
      accessibilityNeeds: [],
      behaviorNotes: "Tries recovery paths quickly and relies on search/navigation cues."
    },
    {
      name: "Field Technician",
      role: "Service Technician",
      industry: "Energy",
      technicalProficiency: 49,
      domainExpertise: 71,
      timePressure: 82,
      patience: 33,
      confidence: 52,
      errorRecovery: 59,
      riskTolerance: 62,
      accessibilityNeeds: ["large-touch-targets"],
      behaviorNotes: "Uses shortest path under pressure and may skip optional guidance content."
    }
  ];

  await prisma.persona.createMany({
    data: personas.map((persona) => ({
      organizationId: organization.id,
      ...persona
    }))
  });

  await prisma.testAccount.createMany({
    data: Array.from({ length: 20 }, (_, i) => {
      const suffix = String(i + 1).padStart(2, "0");
      return {
        organizationId: organization.id,
        environmentId: environment.id,
        label: `Seed Account ${suffix}`,
        username: `test_user_${suffix}`,
        email: `test_user_${suffix}@example.local`,
        role: "tester",
        passwordSecretRef: `seed://test_user_${suffix}`,
        encryptedPassword: null,
        allowConcurrentUse: false,
        status: "AVAILABLE",
        notes: "Seeded test account"
      };
    })
  });

  const workflows = [
    {
      name: "Sign In and Dashboard",
      description: "Validate primary sign-in path",
      goal: "User signs in and reaches dashboard",
      startingPath: "/login",
      maxSteps: 40,
      maxDurationSeconds: 300,
      successCriteria: [{ type: "URL_CONTAINS", value: "/dashboard" }],
      workflowType: "GOAL_BASED",
      status: "ACTIVE"
    },
    {
      name: "Checkout Journey",
      description: "Validate checkout completion",
      goal: "User completes checkout flow",
      startingPath: "/cart",
      maxSteps: 80,
      maxDurationSeconds: 600,
      successCriteria: [{ type: "PAGE_CONTAINS_TEXT", value: "Thank you" }],
      workflowType: "SCRIPTED",
      status: "DRAFT"
    },
    {
      name: "Profile Update",
      description: "Validate profile edits",
      goal: "User updates profile information",
      startingPath: "/settings/profile",
      maxSteps: 50,
      maxDurationSeconds: 420,
      successCriteria: [{ type: "ELEMENT_VISIBLE", value: "profile-save-success" }],
      workflowType: "EXPLORATORY",
      status: "DRAFT"
    }
  ];

  await prisma.workflow.createMany({
    data: workflows.map((workflow) => ({
      organizationId: organization.id,
      projectId: project.id,
      name: workflow.name,
      description: workflow.description,
      goal: workflow.goal,
      startingPath: workflow.startingPath,
      maxSteps: workflow.maxSteps,
      maxDurationSeconds: workflow.maxDurationSeconds,
      successCriteria: workflow.successCriteria,
      workflowType: workflow.workflowType,
      status: workflow.status
    }))
  });

  console.log("Seed complete", {
    organizationId: organization.id,
    adminUserId: adminUser.id,
    adminEmail: adminUser.email,
    projectId: project.id,
    environmentId: environment.id
  });
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


