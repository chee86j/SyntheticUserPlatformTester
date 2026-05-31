import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const organization = await prisma.organization.create({
    data: {
      name: "Synthetic Labs"
    }
  });

  const adminUser = await prisma.user.create({
    data: {
      organizationId: organization.id,
      email: "admin@syntheticlabs.local",
      name: "Platform Admin",
      role: "admin"
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
      baseUrl: "https://staging.example.local"
    }
  });

  const personaNames = [
    "Speed Runner",
    "Cautious Explorer",
    "Error Prone Clicker",
    "Detail Checker",
    "Power User"
  ];

  await prisma.persona.createMany({
    data: personaNames.map((name) => ({
      organizationId: organization.id,
      name,
      description: `${name} baseline persona`
    }))
  });

  await prisma.testAccount.createMany({
    data: Array.from({ length: 20 }, (_, i) => ({
      organizationId: organization.id,
      environmentId: environment.id,
      username: `test_user_${String(i + 1).padStart(2, "0")}`,
      password: `test_password_${String(i + 1).padStart(2, "0")}`,
      isActive: true
    }))
  });

  const workflows = [
    { name: "Sign In and Dashboard", entryPath: "/login" },
    { name: "Checkout Journey", entryPath: "/cart" },
    { name: "Profile Update", entryPath: "/settings/profile" }
  ];

  await prisma.workflow.createMany({
    data: workflows.map((workflow) => ({
      organizationId: organization.id,
      projectId: project.id,
      name: workflow.name,
      description: `${workflow.name} synthetic flow`,
      entryPath: workflow.entryPath
    }))
  });

  console.log("Seed complete", {
    organizationId: organization.id,
    adminUserId: adminUser.id,
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
