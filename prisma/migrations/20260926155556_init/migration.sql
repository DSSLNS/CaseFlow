-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "severities" TEXT NOT NULL DEFAULT 'Blocker
Critical
Major
Normal
Minor
Trivial',
    "caseCounter" INTEGER NOT NULL DEFAULT 0,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Suite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Suite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Suite_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Suite" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TestCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "preconditions" TEXT NOT NULL DEFAULT '',
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "type" TEXT NOT NULL DEFAULT 'Functional',
    "severity" TEXT,
    "assigneeId" TEXT,
    "estimateMinutes" INTEGER,
    "automationStatus" TEXT NOT NULL DEFAULT 'Not Automated',
    "automationRef" TEXT NOT NULL DEFAULT '',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TestCase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TestCase_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "Suite" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TestCase_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TestCase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TestCase_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TestStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "testCaseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "expectedResult" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "TestStep_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "Tag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TestCaseTag" (
    "testCaseId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    PRIMARY KEY ("testCaseId", "tagId"),
    CONSTRAINT "TestCaseTag_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TestCaseTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "testCaseId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TestRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "ownerId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "TestRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TestRun_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TestRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TestRunCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "testCaseId" TEXT,
    "position" INTEGER NOT NULL,
    "caseKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "suiteName" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "preconditions" TEXT NOT NULL DEFAULT '',
    "stepsSnapshot" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'Not Run',
    "comment" TEXT NOT NULL DEFAULT '',
    "evidenceUrl" TEXT NOT NULL DEFAULT '',
    "bugRef" TEXT NOT NULL DEFAULT '',
    "executedById" TEXT,
    "executedAt" DATETIME,
    CONSTRAINT "TestRunCase_runId_fkey" FOREIGN KEY ("runId") REFERENCES "TestRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TestRunCase_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TestRunCase_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TestExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runCaseId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "evidenceUrl" TEXT NOT NULL DEFAULT '',
    "bugRef" TEXT NOT NULL DEFAULT '',
    "executedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestExecution_runCaseId_fkey" FOREIGN KEY ("runCaseId") REFERENCES "TestRunCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TestExecution_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "duplicateStrategy" TEXT NOT NULL,
    "mapping" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportBatch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportRowResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "testCaseId" TEXT,
    "caseKey" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "ImportRowResult_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE INDEX "Suite_projectId_idx" ON "Suite"("projectId");

-- CreateIndex
CREATE INDEX "Suite_parentId_idx" ON "Suite"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Suite_projectId_parentId_name_key" ON "Suite"("projectId", "parentId", "name");

-- CreateIndex
CREATE INDEX "TestCase_projectId_suiteId_idx" ON "TestCase"("projectId", "suiteId");

-- CreateIndex
CREATE INDEX "TestCase_projectId_title_idx" ON "TestCase"("projectId", "title");

-- CreateIndex
CREATE INDEX "TestCase_projectId_status_idx" ON "TestCase"("projectId", "status");

-- CreateIndex
CREATE INDEX "TestCase_projectId_priority_idx" ON "TestCase"("projectId", "priority");

-- CreateIndex
CREATE INDEX "TestCase_projectId_type_idx" ON "TestCase"("projectId", "type");

-- CreateIndex
CREATE INDEX "TestCase_projectId_assigneeId_idx" ON "TestCase"("projectId", "assigneeId");

-- CreateIndex
CREATE INDEX "TestCase_projectId_updatedAt_idx" ON "TestCase"("projectId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TestCase_projectId_number_key" ON "TestCase"("projectId", "number");

-- CreateIndex
CREATE INDEX "TestStep_testCaseId_position_idx" ON "TestStep"("testCaseId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_projectId_name_key" ON "Tag"("projectId", "name");

-- CreateIndex
CREATE INDEX "TestCaseTag_tagId_idx" ON "TestCaseTag"("tagId");

-- CreateIndex
CREATE INDEX "Attachment_testCaseId_idx" ON "Attachment"("testCaseId");

-- CreateIndex
CREATE INDEX "TestRun_projectId_createdAt_idx" ON "TestRun"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "TestRunCase_runId_position_idx" ON "TestRunCase"("runId", "position");

-- CreateIndex
CREATE INDEX "TestRunCase_testCaseId_idx" ON "TestRunCase"("testCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "TestRunCase_runId_testCaseId_key" ON "TestRunCase"("runId", "testCaseId");

-- CreateIndex
CREATE INDEX "TestExecution_runCaseId_createdAt_idx" ON "TestExecution"("runCaseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_idempotencyKey_key" ON "ImportBatch"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ImportBatch_projectId_createdAt_idx" ON "ImportBatch"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportBatch_projectId_fileHash_idx" ON "ImportBatch"("projectId", "fileHash");

-- CreateIndex
CREATE INDEX "ImportRowResult_batchId_rowNumber_idx" ON "ImportRowResult"("batchId", "rowNumber");
