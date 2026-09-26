import "server-only";
import { db } from "@/lib/db";
import type { ResultInput, RunInput } from "@/lib/validation";
import { flattenTree } from "@/lib/suite-tree";
import { ServiceError } from "./errors";

export type RunCounts = { total: number; Pass: number; Fail: number; Blocked: number; "Not Run": number };

export function emptyCounts(): RunCounts {
  return { total: 0, Pass: 0, Fail: 0, Blocked: 0, "Not Run": 0 };
}

export async function countsByRun(runIds: string[]) {
  const rows = await db.testRunCase.groupBy({
    by: ["runId", "status"],
    where: { runId: { in: runIds } },
    _count: { _all: true },
  });
  const map = new Map<string, RunCounts>();
  for (const id of runIds) map.set(id, emptyCounts());
  for (const r of rows) {
    const c = map.get(r.runId)!;
    c.total += r._count._all;
    if (r.status in c) c[r.status as keyof Omit<RunCounts, "total">] += r._count._all;
  }
  return map;
}

export async function listRuns(projectId: string, take?: number) {
  const runs = await db.testRun.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take,
    include: { owner: { select: { name: true } }, createdBy: { select: { name: true } } },
  });
  const counts = await countsByRun(runs.map((r) => r.id));
  return runs.map((r) => ({ ...r, counts: counts.get(r.id)! }));
}

export async function createRun(input: RunInput, userId: string | null) {
  return db.$transaction(async (tx) => {
    const project = await tx.project.findUnique({ where: { id: input.projectId } });
    if (!project) throw new ServiceError("Project not found.");
    if (input.ownerId && !(await tx.user.findUnique({ where: { id: input.ownerId } }))) {
      throw new ServiceError("Owner not found.", "ownerId");
    }
    const cases = await tx.testCase.findMany({
      where: { projectId: project.id, id: { in: input.caseIds }, archived: false },
      include: { steps: { orderBy: { position: "asc" } }, suite: true },
    });
    if (!cases.length) throw new ServiceError("None of the selected test cases are available in this project.", "caseIds");

    // Order cases the way they appear in the suite tree, then by ID.
    const suites = await tx.suite.findMany({ where: { projectId: project.id } });
    const suiteOrder = new Map(flattenTree(suites).map((s, i) => [s.id, i]));
    const suitePath = new Map(flattenTree(suites).map((s) => [s.id, s.path]));
    cases.sort((a, b) => (suiteOrder.get(a.suiteId) ?? 0) - (suiteOrder.get(b.suiteId) ?? 0) || a.number - b.number);

    const sourceSuites = flattenTree(suites)
      .filter((s) => input.suiteIds.includes(s.id))
      .map((s) => s.path)
      .join(", ");
    const run = await tx.testRun.create({
      data: {
        projectId: project.id,
        title: input.title,
        description: input.description,
        environment: input.environment,
        buildVersion: input.buildVersion,
        releaseRef: input.releaseRef,
        executionDate: input.executionDate ? new Date(`${input.executionDate}T00:00:00Z`) : null,
        sourceSuites,
        ownerId: input.ownerId || null,
        createdById: userId,
      },
    });
    await tx.testRunCase.createMany({
      data: cases.map((c, i) => ({
        runId: run.id,
        testCaseId: c.id,
        position: i,
        caseKey: `${project.code}-${c.number}`,
        title: c.title,
        suiteName: suitePath.get(c.suiteId) ?? c.suite.name,
        priority: c.priority,
        preconditions: c.preconditions,
        stepsSnapshot: JSON.stringify(c.steps.map((s) => ({ action: s.action, expectedResult: s.expectedResult }))),
      })),
    });
    return { id: run.id, caseCount: cases.length };
  });
}

export async function getRun(projectId: string, runId: string) {
  return db.testRun.findFirst({
    where: { id: runId, projectId },
    include: {
      owner: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      cases: {
        orderBy: { position: "asc" },
        include: {
          executedBy: { select: { name: true } },
          executions: {
            orderBy: { createdAt: "desc" },
            include: { executedBy: { select: { name: true } }, evidence: { orderBy: { createdAt: "asc" } } },
          },
        },
      },
    },
  });
}

export async function recordResult(projectId: string, input: ResultInput, userId: string | null) {
  const runCase = await db.testRunCase.findFirst({
    where: { id: input.runCaseId, run: { projectId } },
    include: { run: true },
  });
  if (!runCase) throw new ServiceError("This case is no longer part of the run.");
  if (runCase.run.status === "Completed") throw new ServiceError("This run is completed. Reopen it to record results.");
  const bugRef = input.status === "Fail" ? input.bugRef : "";
  const now = new Date();
  return db.$transaction(async (tx) => {
    const updated = await tx.testRunCase.update({
      where: { id: runCase.id },
      data: {
        status: input.status,
        comment: input.comment,
        bugRef,
        executedById: input.status === "Not Run" ? null : userId,
        executedAt: input.status === "Not Run" ? null : now,
      },
    });
    // Each recording is a new execution with its own evidence; history is never rewritten.
    await tx.testExecution.create({
      data: {
        runCaseId: runCase.id,
        status: input.status,
        comment: input.comment,
        bugRef,
        executedById: userId,
        createdAt: now,
        evidence: {
          create: input.evidence.map((e) => ({
            kind: e.kind,
            label: e.label,
            url: e.url,
            provider: "url",
            createdById: userId,
          })),
        },
      },
    });
    await tx.testRun.update({ where: { id: runCase.runId }, data: { updatedAt: now } });
    return updated;
  });
}

export async function setRunStatus(projectId: string, runId: string, status: "Active" | "Completed") {
  const run = await db.testRun.findFirst({ where: { id: runId, projectId } });
  if (!run) throw new ServiceError("Run not found.");
  return db.testRun.update({
    where: { id: runId },
    data: { status, completedAt: status === "Completed" ? new Date() : null },
  });
}

export async function deleteRun(projectId: string, runId: string) {
  const res = await db.testRun.deleteMany({ where: { id: runId, projectId } });
  if (!res.count) throw new ServiceError("Run not found.");
}
