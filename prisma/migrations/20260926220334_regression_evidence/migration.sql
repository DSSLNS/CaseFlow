-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "executionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'link',
    "label" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'url',
    "externalFileId" TEXT,
    "externalFolder" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Evidence_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "TestExecution" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Evidence_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TestExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runCaseId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "bugRef" TEXT NOT NULL DEFAULT '',
    "executedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestExecution_runCaseId_fkey" FOREIGN KEY ("runCaseId") REFERENCES "TestRunCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TestExecution_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TestExecution" ("bugRef", "comment", "createdAt", "executedById", "id", "runCaseId", "status") SELECT "bugRef", "comment", "createdAt", "executedById", "id", "runCaseId", "status" FROM "TestExecution";
DROP TABLE "TestExecution";
ALTER TABLE "new_TestExecution" RENAME TO "TestExecution";
CREATE INDEX "TestExecution_runCaseId_createdAt_idx" ON "TestExecution"("runCaseId", "createdAt");
CREATE TABLE "new_TestRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "environment" TEXT NOT NULL DEFAULT '',
    "buildVersion" TEXT NOT NULL DEFAULT '',
    "releaseRef" TEXT NOT NULL DEFAULT '',
    "executionDate" DATETIME,
    "sourceSuites" TEXT NOT NULL DEFAULT '',
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
INSERT INTO "new_TestRun" ("completedAt", "createdAt", "createdById", "description", "id", "ownerId", "projectId", "status", "title", "updatedAt") SELECT "completedAt", "createdAt", "createdById", "description", "id", "ownerId", "projectId", "status", "title", "updatedAt" FROM "TestRun";
DROP TABLE "TestRun";
ALTER TABLE "new_TestRun" RENAME TO "TestRun";
CREATE INDEX "TestRun_projectId_createdAt_idx" ON "TestRun"("projectId", "createdAt");
CREATE TABLE "new_TestRunCase" (
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
    "bugRef" TEXT NOT NULL DEFAULT '',
    "executedById" TEXT,
    "executedAt" DATETIME,
    CONSTRAINT "TestRunCase_runId_fkey" FOREIGN KEY ("runId") REFERENCES "TestRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TestRunCase_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TestRunCase_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TestRunCase" ("bugRef", "caseKey", "comment", "executedAt", "executedById", "id", "position", "preconditions", "priority", "runId", "status", "stepsSnapshot", "suiteName", "testCaseId", "title") SELECT "bugRef", "caseKey", "comment", "executedAt", "executedById", "id", "position", "preconditions", "priority", "runId", "status", "stepsSnapshot", "suiteName", "testCaseId", "title" FROM "TestRunCase";
DROP TABLE "TestRunCase";
ALTER TABLE "new_TestRunCase" RENAME TO "TestRunCase";
CREATE INDEX "TestRunCase_runId_position_idx" ON "TestRunCase"("runId", "position");
CREATE INDEX "TestRunCase_testCaseId_idx" ON "TestRunCase"("testCaseId");
CREATE UNIQUE INDEX "TestRunCase_runId_testCaseId_key" ON "TestRunCase"("runId", "testCaseId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Evidence_executionId_idx" ON "Evidence"("executionId");

