import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const organization =
    (await prisma.organization.findFirst({
      where: {
        name: "Synthetic Labs"
      }
    })) ??
    (await prisma.organization.create({
      data: {
        name: "Synthetic Labs"
      }
    }));

  const adminPassword = "ChangeMe123!";
  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);

  const adminUser =
    (await prisma.user.findUnique({
      where: {
        email: "admin@syntheticlabs.local"
      }
    })) ??
    (await prisma.user.create({
      data: {
        organizationId: organization.id,
        email: "admin@syntheticlabs.local",
        name: "Platform Owner",
        role: "OWNER",
        passwordHash: adminPasswordHash
      }
    }));

  if (adminUser.passwordHash !== adminPasswordHash) {
    await prisma.user.update({
      where: {
        email: adminUser.email
      },
      data: {
        organizationId: organization.id,
        name: "Platform Owner",
        role: "OWNER",
        passwordHash: adminPasswordHash
      }
    });
  }

  const budgetPolicy =
    (await prisma.budgetPolicy.findFirst({
      where: {
        organizationId: organization.id,
        name: "Default Budget"
      }
    })) ??
    (await prisma.budgetPolicy.create({
      data: {
        organizationId: organization.id,
        name: "Default Budget",
        maxCostPerRun: "50.0000",
        maxTokensPerRun: 500000,
        maxActionsPerAgent: 200,
        maxDurationPerRunSeconds: 900,
        maxDailyCost: "250.0000",
        stopOnBudgetExceeded: true,
        isActive: true
      }
    }));

  const project =
    (await prisma.project.findFirst({
      where: {
        organizationId: organization.id,
        name: "Core Validation"
      }
    })) ??
    (await prisma.project.create({
      data: {
        organizationId: organization.id,
        name: "Core Validation"
      }
    }));

  const environment =
    (await prisma.environment.findFirst({
      where: {
        projectId: project.id,
        name: "staging"
      }
    })) ??
    (await prisma.environment.create({
      data: {
        organizationId: organization.id,
        projectId: project.id,
        name: "staging",
        baseUrl: "https://staging.example.local",
        type: "STAGING",
        allowedDomains: ["staging.example.local"],
        status: "ACTIVE"
      }
    }));

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
    },
    {
      name: "Hospital - Emergency Physician",
      role: "Emergency Medicine Physician",
      industry: "Hospital",
      technicalProficiency: 68,
      domainExpertise: 95,
      timePressure: 96,
      patience: 28,
      confidence: 88,
      errorRecovery: 82,
      riskTolerance: 71,
      accessibilityNeeds: [],
      behaviorNotes: "Moves quickly through urgent workflows, expects high information density, and abandons unclear detours."
    },
    {
      name: "Hospital - Resident Physician",
      role: "Medical Resident",
      industry: "Hospital",
      technicalProficiency: 73,
      domainExpertise: 76,
      timePressure: 91,
      patience: 38,
      confidence: 62,
      errorRecovery: 76,
      riskTolerance: 58,
      accessibilityNeeds: [],
      behaviorNotes: "Follows protocol but may over-navigate when clinical wording or hierarchy is unclear."
    },
    {
      name: "Hospital - Charge Nurse",
      role: "Charge Nurse",
      industry: "Hospital",
      technicalProficiency: 61,
      domainExpertise: 91,
      timePressure: 88,
      patience: 42,
      confidence: 80,
      errorRecovery: 84,
      riskTolerance: 48,
      accessibilityNeeds: ["large-touch-targets"],
      behaviorNotes: "Coordinates many tasks at once and expects fast recovery from errors or missing patient context."
    },
    {
      name: "Hospital - Bedside Nurse",
      role: "Registered Nurse",
      industry: "Hospital",
      technicalProficiency: 54,
      domainExpertise: 86,
      timePressure: 84,
      patience: 44,
      confidence: 70,
      errorRecovery: 78,
      riskTolerance: 39,
      accessibilityNeeds: ["high-contrast text"],
      behaviorNotes: "Needs clear medication, charting, and handoff flows with minimal ambiguity under time pressure."
    },
    {
      name: "Hospital - Pharmacist",
      role: "Clinical Pharmacist",
      industry: "Hospital",
      technicalProficiency: 66,
      domainExpertise: 94,
      timePressure: 72,
      patience: 68,
      confidence: 82,
      errorRecovery: 80,
      riskTolerance: 24,
      accessibilityNeeds: [],
      behaviorNotes: "Checks dosing, contraindication, and approval language carefully before committing actions."
    },
    {
      name: "Hospital - Lab Technician",
      role: "Medical Laboratory Technician",
      industry: "Hospital",
      technicalProficiency: 59,
      domainExpertise: 81,
      timePressure: 70,
      patience: 56,
      confidence: 68,
      errorRecovery: 65,
      riskTolerance: 31,
      accessibilityNeeds: [],
      behaviorNotes: "Prioritizes specimen status, result entry, and batch workflows with precise labels."
    },
    {
      name: "Hospital - Radiology Technologist",
      role: "Radiology Technologist",
      industry: "Hospital",
      technicalProficiency: 62,
      domainExpertise: 84,
      timePressure: 76,
      patience: 50,
      confidence: 72,
      errorRecovery: 70,
      riskTolerance: 36,
      accessibilityNeeds: ["large-touch-targets"],
      behaviorNotes: "Moves between scheduling, imaging orders, and patient preparation while avoiding irreversible mistakes."
    },
    {
      name: "Hospital - Physical Therapist",
      role: "Physical Therapist",
      industry: "Hospital",
      technicalProficiency: 48,
      domainExpertise: 80,
      timePressure: 63,
      patience: 74,
      confidence: 67,
      errorRecovery: 69,
      riskTolerance: 42,
      accessibilityNeeds: [],
      behaviorNotes: "Documents progress and care plans carefully, preferring explicit save states and clear patient identifiers."
    },
    {
      name: "Hospital - Case Manager",
      role: "Case Manager",
      industry: "Hospital",
      technicalProficiency: 57,
      domainExpertise: 83,
      timePressure: 79,
      patience: 53,
      confidence: 71,
      errorRecovery: 74,
      riskTolerance: 35,
      accessibilityNeeds: [],
      behaviorNotes: "Navigates discharge, referral, and insurance coordination flows with many cross-system dependencies."
    },
    {
      name: "Hospital - Patient Access",
      role: "Patient Access Representative",
      industry: "Hospital",
      technicalProficiency: 45,
      domainExpertise: 69,
      timePressure: 82,
      patience: 40,
      confidence: 58,
      errorRecovery: 60,
      riskTolerance: 30,
      accessibilityNeeds: ["plain-language labels"],
      behaviorNotes: "Works registration and intake quickly and needs form validation to be specific and recoverable."
    },
    {
      name: "Hospital - Billing Specialist",
      role: "Revenue Cycle Specialist",
      industry: "Hospital",
      technicalProficiency: 63,
      domainExpertise: 78,
      timePressure: 65,
      patience: 62,
      confidence: 73,
      errorRecovery: 71,
      riskTolerance: 28,
      accessibilityNeeds: [],
      behaviorNotes: "Looks for claim status, coding details, audit trails, and reversible corrections."
    },
    {
      name: "Hospital - Administrator",
      role: "Hospital Administrator",
      industry: "Hospital",
      technicalProficiency: 64,
      domainExpertise: 88,
      timePressure: 77,
      patience: 58,
      confidence: 86,
      errorRecovery: 73,
      riskTolerance: 52,
      accessibilityNeeds: [],
      behaviorNotes: "Scans dashboards and approval flows for operational signal, compliance risk, and staffing impact."
    },
    {
      name: "Hospital - IT Support",
      role: "Clinical IT Support Analyst",
      industry: "Hospital",
      technicalProficiency: 87,
      domainExpertise: 66,
      timePressure: 74,
      patience: 66,
      confidence: 84,
      errorRecovery: 90,
      riskTolerance: 57,
      accessibilityNeeds: [],
      behaviorNotes: "Troubleshoots permissions, device issues, and workflow breakage while expecting diagnostic details."
    },
    {
      name: "Hospital - Environmental Services",
      role: "Environmental Services Supervisor",
      industry: "Hospital",
      technicalProficiency: 38,
      domainExpertise: 72,
      timePressure: 81,
      patience: 35,
      confidence: 54,
      errorRecovery: 55,
      riskTolerance: 44,
      accessibilityNeeds: ["large-touch-targets", "plain-language labels"],
      behaviorNotes: "Needs mobile-friendly task queues, simple status changes, and clear room or unit identifiers."
    },
    {
      name: "Hospital - Facilities Manager",
      role: "Facilities and Biomedical Manager",
      industry: "Hospital",
      technicalProficiency: 70,
      domainExpertise: 77,
      timePressure: 69,
      patience: 57,
      confidence: 76,
      errorRecovery: 78,
      riskTolerance: 50,
      accessibilityNeeds: [],
      behaviorNotes: "Tracks work orders, equipment status, and maintenance priority across clinical areas."
    },
    {
      name: "University - Tenured Professor",
      role: "Professor",
      industry: "Higher Education",
      technicalProficiency: 58,
      domainExpertise: 94,
      timePressure: 66,
      patience: 70,
      confidence: 86,
      errorRecovery: 64,
      riskTolerance: 45,
      accessibilityNeeds: [],
      behaviorNotes: "Expects academic workflows to preserve context across teaching, research, and committee tasks."
    },
    {
      name: "University - Adjunct Instructor",
      role: "Adjunct Instructor",
      industry: "Higher Education",
      technicalProficiency: 46,
      domainExpertise: 76,
      timePressure: 86,
      patience: 37,
      confidence: 58,
      errorRecovery: 56,
      riskTolerance: 34,
      accessibilityNeeds: ["plain-language labels"],
      behaviorNotes: "Works quickly between limited campus access windows and needs direct routes to grading and rosters."
    },
    {
      name: "University - Lecturer",
      role: "Lecturer",
      industry: "Higher Education",
      technicalProficiency: 55,
      domainExpertise: 82,
      timePressure: 78,
      patience: 48,
      confidence: 65,
      errorRecovery: 63,
      riskTolerance: 38,
      accessibilityNeeds: [],
      behaviorNotes: "Handles course content, student messages, and assessment tasks with moderate tolerance for detours."
    },
    {
      name: "University - Department Chair",
      role: "Department Chair",
      industry: "Higher Education",
      technicalProficiency: 62,
      domainExpertise: 90,
      timePressure: 83,
      patience: 52,
      confidence: 82,
      errorRecovery: 70,
      riskTolerance: 48,
      accessibilityNeeds: [],
      behaviorNotes: "Reviews approvals, hiring, curriculum, and reporting flows while scanning for policy implications."
    },
    {
      name: "University - Academic Advisor",
      role: "Academic Advisor",
      industry: "Higher Education",
      technicalProficiency: 57,
      domainExpertise: 84,
      timePressure: 80,
      patience: 66,
      confidence: 72,
      errorRecovery: 77,
      riskTolerance: 32,
      accessibilityNeeds: [],
      behaviorNotes: "Needs clear student records, degree requirements, notes, and escalation paths."
    },
    {
      name: "University - Registrar",
      role: "Registrar Staff",
      industry: "Higher Education",
      technicalProficiency: 69,
      domainExpertise: 88,
      timePressure: 75,
      patience: 60,
      confidence: 78,
      errorRecovery: 73,
      riskTolerance: 25,
      accessibilityNeeds: [],
      behaviorNotes: "Checks enrollment, transcript, schedule, and policy workflows with a low tolerance for ambiguous commits."
    },
    {
      name: "University - Admissions Counselor",
      role: "Admissions Counselor",
      industry: "Higher Education",
      technicalProficiency: 52,
      domainExpertise: 74,
      timePressure: 82,
      patience: 55,
      confidence: 66,
      errorRecovery: 67,
      riskTolerance: 43,
      accessibilityNeeds: [],
      behaviorNotes: "Moves through applicant records, communications, and decision workflows during deadline pressure."
    },
    {
      name: "University - Financial Aid Officer",
      role: "Financial Aid Officer",
      industry: "Higher Education",
      technicalProficiency: 61,
      domainExpertise: 86,
      timePressure: 79,
      patience: 58,
      confidence: 75,
      errorRecovery: 72,
      riskTolerance: 22,
      accessibilityNeeds: ["high-contrast text"],
      behaviorNotes: "Needs precise status, award, verification, and compliance language before completing actions."
    },
    {
      name: "University - Research Administrator",
      role: "Research Administrator",
      industry: "Higher Education",
      technicalProficiency: 74,
      domainExpertise: 82,
      timePressure: 72,
      patience: 62,
      confidence: 76,
      errorRecovery: 77,
      riskTolerance: 30,
      accessibilityNeeds: [],
      behaviorNotes: "Navigates grants, approvals, compliance records, and budget details with auditability in mind."
    },
    {
      name: "University - Principal Investigator",
      role: "Principal Investigator",
      industry: "Higher Education",
      technicalProficiency: 67,
      domainExpertise: 93,
      timePressure: 87,
      patience: 41,
      confidence: 85,
      errorRecovery: 69,
      riskTolerance: 54,
      accessibilityNeeds: [],
      behaviorNotes: "Looks for fast grant, lab, protocol, and reporting workflows while juggling many obligations."
    },
    {
      name: "University - Lab Manager",
      role: "Research Lab Manager",
      industry: "Higher Education",
      technicalProficiency: 71,
      domainExpertise: 79,
      timePressure: 73,
      patience: 57,
      confidence: 74,
      errorRecovery: 79,
      riskTolerance: 46,
      accessibilityNeeds: [],
      behaviorNotes: "Manages inventory, safety, access, and lab operations with practical recovery from broken tasks."
    },
    {
      name: "University - Librarian",
      role: "Academic Librarian",
      industry: "Higher Education",
      technicalProficiency: 65,
      domainExpertise: 87,
      timePressure: 55,
      patience: 84,
      confidence: 72,
      errorRecovery: 75,
      riskTolerance: 26,
      accessibilityNeeds: ["screen-reader-compatible labels"],
      behaviorNotes: "Searches, filters, and verifies information architecture carefully and notices labeling inconsistency."
    },
    {
      name: "University - Instructional Designer",
      role: "Instructional Designer",
      industry: "Higher Education",
      technicalProficiency: 82,
      domainExpertise: 78,
      timePressure: 68,
      patience: 73,
      confidence: 79,
      errorRecovery: 83,
      riskTolerance: 42,
      accessibilityNeeds: ["reduced-motion"],
      behaviorNotes: "Evaluates course-building, accessibility, content reuse, and learner-facing clarity."
    },
    {
      name: "University - Student Affairs",
      role: "Student Affairs Coordinator",
      industry: "Higher Education",
      technicalProficiency: 50,
      domainExpertise: 77,
      timePressure: 74,
      patience: 68,
      confidence: 63,
      errorRecovery: 71,
      riskTolerance: 37,
      accessibilityNeeds: ["plain-language labels"],
      behaviorNotes: "Uses case notes, referrals, communication workflows, and student support routing."
    },
    {
      name: "University - Accessibility Coordinator",
      role: "Accessibility Services Coordinator",
      industry: "Higher Education",
      technicalProficiency: 64,
      domainExpertise: 89,
      timePressure: 69,
      patience: 81,
      confidence: 77,
      errorRecovery: 78,
      riskTolerance: 21,
      accessibilityNeeds: ["screen-reader-compatible labels", "keyboard navigation"],
      behaviorNotes: "Audits accommodation flows, accessible naming, keyboard behavior, and plain-language support."
    },
    {
      name: "University - Campus IT",
      role: "Campus IT Support Specialist",
      industry: "Higher Education",
      technicalProficiency: 89,
      domainExpertise: 70,
      timePressure: 76,
      patience: 61,
      confidence: 83,
      errorRecovery: 91,
      riskTolerance: 55,
      accessibilityNeeds: [],
      behaviorNotes: "Troubleshoots access, identity, integration, and device issues while expecting useful diagnostics."
    },
    {
      name: "University - Facilities Coordinator",
      role: "Facilities Coordinator",
      industry: "Higher Education",
      technicalProficiency: 43,
      domainExpertise: 73,
      timePressure: 78,
      patience: 46,
      confidence: 57,
      errorRecovery: 58,
      riskTolerance: 47,
      accessibilityNeeds: ["large-touch-targets"],
      behaviorNotes: "Uses mobile work orders, room scheduling, maintenance routing, and status updates across campus."
    }
  ];

  await prisma.persona.createMany({
    data: personas.map((persona) => ({
      organizationId: organization.id,
      ...persona
    })),
    skipDuplicates: true
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
    }),
    skipDuplicates: true
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
    })),
    skipDuplicates: true
  });

  await prisma.budgetPolicy.update({
    where: {
      organizationId_name: {
        organizationId: organization.id,
        name: "Default Budget"
      }
    },
    data: {
      maxCostPerRun: "50.0000",
      maxTokensPerRun: 500000,
      maxActionsPerAgent: 200,
      maxDurationPerRunSeconds: 900,
      maxDailyCost: "250.0000",
      stopOnBudgetExceeded: true,
      isActive: true
    }
  });

  const refreshedAdminUser = await prisma.user.findUnique({
    where: {
      email: adminUser.email
    }
  });

  console.log("Seed complete", {
    organizationId: organization.id,
    adminUserId: refreshedAdminUser?.id ?? adminUser.id,
    adminEmail: adminUser.email,
    projectId: project.id,
    environmentId: environment.id,
    budgetPolicyId: budgetPolicy.id
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



