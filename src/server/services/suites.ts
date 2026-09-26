import "server-only";
import { db } from "@/lib/db";
import { descendantIds } from "@/lib/suite-tree";
import { ServiceError } from "./errors";

export async function listSuites(projectId: string) {
  return db.suite.findMany({
    where: { projectId },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, name: true, parentId: true, position: true, description: true },
  });
}

/** Suites with direct and total (including descendants) active case counts. */
export async function listSuitesWithCounts(projectId: string) {
  const [suites, counts] = await Promise.all([
    listSuites(projectId),
    db.testCase.groupBy({
      by: ["suiteId"],
      where: { projectId, archived: false },
      _count: { _all: true },
    }),
  ]);
  const direct = new Map(counts.map((c) => [c.suiteId, c._count._all]));
  return suites.map((s) => ({
    ...s,
    caseCount: direct.get(s.id) ?? 0,
    totalCount: descendantIds(suites, s.id).reduce((sum, id) => sum + (direct.get(id) ?? 0), 0),
  }));
}

async function assertUniqueName(projectId: string, parentId: string | null, name: string, exceptId?: string) {
  const clash = await db.suite.findFirst({
    where: { projectId, parentId, name: { equals: name }, NOT: exceptId ? { id: exceptId } : undefined },
    select: { id: true },
  });
  if (clash) {
    throw new ServiceError(
      parentId ? "A suite with this name already exists in the selected parent." : "A top-level suite with this name already exists.",
      "name",
    );
  }
}

async function assertParent(projectId: string, parentId: string | null) {
  if (!parentId) return;
  const parent = await db.suite.findFirst({ where: { id: parentId, projectId }, select: { id: true } });
  if (!parent) throw new ServiceError("Parent suite not found in this project.", "parentId");
}

export async function createSuite(input: { projectId: string; name: string; description: string; parentId: string | null }) {
  await assertParent(input.projectId, input.parentId);
  await assertUniqueName(input.projectId, input.parentId, input.name);
  const position = await db.suite.count({ where: { projectId: input.projectId, parentId: input.parentId } });
  return db.suite.create({ data: { ...input, position } });
}

export async function updateSuite(
  id: string,
  input: { projectId: string; name: string; description: string; parentId: string | null },
) {
  const suite = await db.suite.findFirst({ where: { id, projectId: input.projectId } });
  if (!suite) throw new ServiceError("Suite not found.");
  if (input.parentId) {
    const all = await listSuites(input.projectId);
    if (descendantIds(all, id).includes(input.parentId)) {
      throw new ServiceError("A suite cannot be moved inside itself or one of its sub-suites.", "parentId");
    }
  }
  await assertParent(input.projectId, input.parentId);
  await assertUniqueName(input.projectId, input.parentId, input.name, id);
  return db.suite.update({
    where: { id },
    data: { name: input.name, description: input.description, parentId: input.parentId },
  });
}

export type SuiteDeleteMode = "block" | "move" | "delete";

/**
 * Deletes a suite and its sub-suites. When the subtree contains test cases the
 * caller must choose explicitly: move them to another suite, or delete them.
 */
export async function deleteSuite(projectId: string, id: string, mode: SuiteDeleteMode, targetSuiteId?: string) {
  const all = await listSuites(projectId);
  if (!all.some((s) => s.id === id)) throw new ServiceError("Suite not found.");
  const subtree = descendantIds(all, id);
  const caseCount = await db.testCase.count({ where: { projectId, suiteId: { in: subtree } } });

  if (caseCount > 0) {
    if (mode === "block") {
      throw new ServiceError(`This suite contains ${caseCount} test case(s). Choose to move or delete them first.`);
    }
    if (mode === "move") {
      if (!targetSuiteId || subtree.includes(targetSuiteId) || !all.some((s) => s.id === targetSuiteId)) {
        throw new ServiceError("Choose a destination suite outside the suite being deleted.", "targetSuiteId");
      }
    }
  }

  // Delete deepest suites first so the Restrict relation on parentId is respected.
  const depth = (sid: string): number => {
    let d = 0;
    let cur = all.find((s) => s.id === sid);
    while (cur?.parentId) {
      d++;
      cur = all.find((s) => s.id === cur!.parentId);
    }
    return d;
  };
  const ordered = [...subtree].sort((a, b) => depth(b) - depth(a));

  await db.$transaction(async (tx) => {
    if (caseCount > 0 && mode === "move") {
      await tx.testCase.updateMany({ where: { projectId, suiteId: { in: subtree } }, data: { suiteId: targetSuiteId } });
    } else if (caseCount > 0 && mode === "delete") {
      await tx.testCase.deleteMany({ where: { projectId, suiteId: { in: subtree } } });
    }
    for (const sid of ordered) await tx.suite.delete({ where: { id: sid } });
  });
  return { deletedSuites: subtree.length, affectedCases: caseCount };
}

/** Finds or creates a suite path like ["Checkout", "Payments"]. */
export async function ensureSuitePath(
  tx: Pick<typeof db, "suite">,
  projectId: string,
  path: string[],
): Promise<string> {
  let parentId: string | null = null;
  for (const name of path) {
    const existing: { id: string } | null = await tx.suite.findFirst({ where: { projectId, parentId, name }, select: { id: true } });
    if (existing) {
      parentId = existing.id;
      continue;
    }
    const position = await tx.suite.count({ where: { projectId, parentId } });
    const created: { id: string } = await tx.suite.create({ data: { projectId, parentId, name, position }, select: { id: true } });
    parentId = created.id;
  }
  if (!parentId) throw new ServiceError("Suite path is empty.");
  return parentId;
}
