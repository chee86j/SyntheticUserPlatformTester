-- CreateTable
CREATE TABLE "ActualMetricsImport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "importedByUserId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'MANUAL_CSV',
    "sourceLabel" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ActualMetricsImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActualWorkflowMetric" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actualMetricsImportId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "taskSuccessRate" DECIMAL(7,2) NOT NULL,
    "completionTimeMs" INTEGER NOT NULL,
    "errorRate" DECIMAL(7,2) NOT NULL,
    "apiCallsPerSession" DECIMAL(10,2) NOT NULL,
    "supportTicketCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ActualWorkflowMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PredictionAccuracy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actualMetricsImportId" TEXT NOT NULL,
    "actualWorkflowMetricId" TEXT NOT NULL,
    "simulationRunId" TEXT,
    "projectId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "syntheticTaskSuccessRate" DECIMAL(7,2) NOT NULL,
    "actualTaskSuccessRate" DECIMAL(7,2) NOT NULL,
    "taskSuccessGapPercent" DECIMAL(9,2),
    "syntheticCompletionTimeMs" INTEGER NOT NULL,
    "actualCompletionTimeMs" INTEGER NOT NULL,
    "completionTimeGapPercent" DECIMAL(9,2),
    "syntheticErrorRate" DECIMAL(7,2) NOT NULL,
    "actualErrorRate" DECIMAL(7,2) NOT NULL,
    "errorRateGapPercent" DECIMAL(9,2),
    "syntheticApiCallsPerSession" DECIMAL(10,2) NOT NULL,
    "actualApiCallsPerSession" DECIMAL(10,2) NOT NULL,
    "apiCallsGapPercent" DECIMAL(9,2),
    "syntheticSupportTicketEstimate" INTEGER NOT NULL,
    "actualSupportTicketCount" INTEGER NOT NULL,
    "supportTicketGapPercent" DECIMAL(9,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PredictionAccuracy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActualMetricsImport_organizationId_createdAt_idx" ON "ActualMetricsImport"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ActualMetricsImport_projectId_environmentId_createdAt_idx" ON "ActualMetricsImport"("projectId", "environmentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ActualWorkflowMetric_actualMetricsImportId_workflowId_key" ON "ActualWorkflowMetric"("actualMetricsImportId", "workflowId");

-- CreateIndex
CREATE INDEX "ActualWorkflowMetric_organizationId_projectId_environmentId_idx" ON "ActualWorkflowMetric"("organizationId", "projectId", "environmentId");

-- CreateIndex
CREATE UNIQUE INDEX "PredictionAccuracy_actualWorkflowMetricId_simulationRunId_key" ON "PredictionAccuracy"("actualWorkflowMetricId", "simulationRunId");

-- CreateIndex
CREATE INDEX "PredictionAccuracy_organizationId_projectId_environmentId_workf_idx" ON "PredictionAccuracy"("organizationId", "projectId", "environmentId", "workflowId");

-- AddForeignKey
ALTER TABLE "ActualMetricsImport" ADD CONSTRAINT "ActualMetricsImport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualMetricsImport" ADD CONSTRAINT "ActualMetricsImport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualMetricsImport" ADD CONSTRAINT "ActualMetricsImport_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualMetricsImport" ADD CONSTRAINT "ActualMetricsImport_importedByUserId_fkey" FOREIGN KEY ("importedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualWorkflowMetric" ADD CONSTRAINT "ActualWorkflowMetric_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualWorkflowMetric" ADD CONSTRAINT "ActualWorkflowMetric_actualMetricsImportId_fkey" FOREIGN KEY ("actualMetricsImportId") REFERENCES "ActualMetricsImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualWorkflowMetric" ADD CONSTRAINT "ActualWorkflowMetric_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualWorkflowMetric" ADD CONSTRAINT "ActualWorkflowMetric_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualWorkflowMetric" ADD CONSTRAINT "ActualWorkflowMetric_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionAccuracy" ADD CONSTRAINT "PredictionAccuracy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionAccuracy" ADD CONSTRAINT "PredictionAccuracy_actualMetricsImportId_fkey" FOREIGN KEY ("actualMetricsImportId") REFERENCES "ActualMetricsImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionAccuracy" ADD CONSTRAINT "PredictionAccuracy_actualWorkflowMetricId_fkey" FOREIGN KEY ("actualWorkflowMetricId") REFERENCES "ActualWorkflowMetric"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionAccuracy" ADD CONSTRAINT "PredictionAccuracy_simulationRunId_fkey" FOREIGN KEY ("simulationRunId") REFERENCES "SimulationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionAccuracy" ADD CONSTRAINT "PredictionAccuracy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionAccuracy" ADD CONSTRAINT "PredictionAccuracy_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionAccuracy" ADD CONSTRAINT "PredictionAccuracy_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
