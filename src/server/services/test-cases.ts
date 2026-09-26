import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseSeverities, PRIORITY_RANK } from "@/lib/constants";
import { parseEstimate } from "@/lib/estimate";
import { parseCaseKey } from "@/lib/format";
import { descendantIds } from "@/lib/suite-tree";
import type { TestCaseInput } from "@/lib/validation";
import { ServiceError } from "./errors";

type Tx = Prisma.TransactionClient;

export const caseDetailInclude = {
  suite: { select: { id: true, name: true, parentId: true } },
  assignee: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true } },
  updatedBy: { select: { id: true, name: true } },
  steps: { orderBy: { position: "asc" } },
  tags: { include: { tag: true } },
  attachments: { orderBy: { createdAt: "asc" }, include: { uploadedBy: { select: { name: true } } } },
  project: { select: { id: true, code: true, name: true } },
} satisfies Prisma.TestCaseInclude;

export type CaseDetail = Prisma.TestCaseGetPayload<{ include: typeof caseDetailInclude }>;

export async function getCaseByKey(projectId: string, code: string, key: string) {
  const number = parseCaseKey(key, code);
  if (number == null) return null;
  return db.testCase.findUnique({
    where: { projectId_number: { projectId, number } },
    include: caseDetailInclude,
  });
}

export async function setTags(tx: Tx, testCaseId: string, projectId: string, names: string[]) {
  const unique = [...new Map(names.map((n) => [n.trim().toLowerCase(), n.trim()])).values()].filter(Boolean);
  await tx.testCaseTag.deleteMany({ where: { testCaseId } });
  for (const name of unique) {
    const existing = await tx.tag.findFirst({ where: { projectId, name } });
    const tag = existing ?? (await tx.tag.create({ data: { projectId, name } }));
    await tx.testCaseTag.create({ data: { testCaseId, tagId: tag.id } });
  }
}

export async function setSteps(tx: Tx, testCaseId: string, steps: { action: string; expectedResult: string }[]) {
  await tx.testStep.deleteMany({ where: { testCaseId } });
  if (steps.length) {
    await tx.testStep.createMany({
      data: steps.map((s, i) => ({ testCaseId, position: i, action: s.action, expectedResult: s.expectedResult })),
    });
  }
}

/** Validates references that Zod cannot check: suite, assignee and severity. */
async function checkReferences(tx: Tx, input: TestCaseInput) {
  const project = await tx.project.findUnique({ where: { id: input.projectId } });
  if (!project) throw new ServiceError("Project not found.", "projectId");
  const suite = await tx.suite.findFirst({ where: { id: input.suiteId, projectId: project.id } });
  if (!suite) throw new ServiceError("Select a suite that belongs to the chosen project.", "suiteId");
  if (input.assigneeId) {
    const user = await tx.user.findUnique({ where: { id: input.assigneeId } });
    if (!user) throw new ServiceError("Assignee not found.", "assigneeId");
  }
  if (input.severity && !parseSeverities(project.severities).includes(input.severity)) {
    throw new ServiceError(`"${input.severity}" is not a configured severity for this project.`, "severity");
  }
  return project;
}

function scalarData(input: TestCaseInput) {
  return {
    title: input.title,
    description: input.description,
    preconditions: input.preconditions,
    priority: input.priority,
    status: input.status,
    type: input.type,
    severity: input.severity || null,
    assigneeId: input.assigneeId || null,
    estimateMinutes: parseEstimate(input.estimate) ?? null,
    automationStatus: input.automationStatus,
    automationRef: input.automationRef,
    suiteId: input.suiteId,
  };
}

export async function nextCaseNumber(tx: Tx, projectId: string) {
  const p = await tx.project.update({
    where: { id: projectId },
    data: { caseCounter: { increment: 1 } },
    select: { caseCounter: true },
  });
  return p.caseCounter;
}

export async function createTestCase(input: TestCaseInput, userId: string | null) {
  return db.$transaction(async (tx) => {
    const project = await checkReferences(tx, input);
    const number = await nextCaseNumber(tx, project.id);
    const created = await tx.testCase.create({
      data: { ...scalarData(input), projectId: project.id, number, createdById: userId, updatedById: userId },
    });
    await setSteps(tx, created.id, input.steps);
    await setTags(tx, created.id, project.id, input.tags);
    return { id: created.id, key: `${project.code}-${number}`, projectCode: project.code };
  });
}

export async function updateTestCase(id: string, input: TestCaseInput, userId: string | null) {
  return db.$transaction(async (tx) => {
    const existing = await tx.testCase.findUnique({ where: { id } });
    if (!existing) throw new ServiceError("Test case not found. It may have been deleted.");
    const project = await checkReferences(tx, input);
    // Moving to a different project assigns a new ID in that project's sequence.
    const number = project.id === existing.projectId ? existing.number : await nextCaseNumber(tx, project.id);
    await tx.testCase.update({
      where: { id },
      data: { ...scalarData(input), projectId: project.id, number, updatedById: userId },
    });
    await setSteps(tx, id, input.steps);
    await setTags(tx, id, project.id, input.tags);
    return { id, key: `${project.code}-${number}`, projectCode: project.code };
  });
}

export async function duplicateTestCase(projectId: string, id: string, userId: string | null) {
  return db.$transaction(async (tx) => {
    const src = await tx.testCase.findFirst({
      where: { id, projectId },
      include: { steps: { orderBy: { position: "asc" } }, tags: { include: { tag: true } }, project: true },
    });
    if (!src) throw new ServiceError("Test case not found.");
    const number = await nextCaseNumber(tx, projectId);
    const copy = await tx.testCase.create({
      data: {
        projectId,
        number,
        suiteId: src.suiteId,
        title: `${src.title} (copy)`.slice(0, 255),
        description: src.description,
        preconditions: src.preconditions,
        priority: src.priority,
        status: "Draft",
        type: src.type,
        severity: src.severity,
        assigneeId: src.assigneeId,
        estimateMinutes: src.estimateMinutes,
        automationStatus: src.automationStatus,
        automationRef: src.automationRef,
        createdById: userId,
        updatedById: userId,
      },
    });
    await setSteps(tx, copy.id, src.steps);
    await setTags(tx, copy.id, projectId, src.tags.map((t) => t.tag.name));
    return { id: copy.id, key: `${src.project.code}-${number}` };
  });
}

export async function deleteTestCases(projectId: string, ids: string[]) {
  const res = await db.testCase.deleteMany({ where: { projectId, id: { in: ids } } });
  return res.count;
}

export async function setArchived(projectId: string, ids: string[], archived: boolean, userId: string | null) {
  const res = await db.testCase.updateMany({
    where: { projectId, id: { in: ids } },
    data: { archived, updatedById: userId },
  });
  return res.count;
}

export async function moveTestCases(projectId: string, ids: string[], suiteId: string, userId: string | null) {
  const suite = await db.suite.findFirst({ where: { id: suiteId, projectId } });
  if (!suite) throw new ServiceError("Destination suite not found in this project.");
  const res = await db.testCase.updateMany({
    where: { projectId, id: { in: ids } },
    data: { suiteId, updatedById: userId },
  });
  return res.count;
}

export async function bulkUpdateField(
  projectId: string,
  ids: string[],
  field: "priority" | "status",
  value: string,
  userId: string | null,
) {
  const res = await db.testCase.updateMany({
    where: { projectId, id: { in: ids } },
    data: { [field]: value, updatedById: userId },
  });
  return res.count;
}

// ---------- Listing ----------

export type CaseListParams = {
  q?: string;
  suite?: string;
  priority?: string;
  status?: string;
  type?: string;
  assignee?: string;
  archived?: string;
  sort?: string;
  dir?: string;
  page?: number;
  pageSize?: number;
};

export const SORTABLE = ["id", "title", "priority", "updated"] as const;

export async function listTestCases(project: { id: string; code: string }, params: CaseListParams) {
  const where: Prisma.TestCaseWhereInput = { projectId: project.id, archived: params.archived === "1" };

  const q = params.q?.trim();
  if (q) {
    const number = parseCaseKey(q, project.code) ?? (/^\d+$/.test(q) ? Number(q) : null);
    where.OR = [{ title: { contains: q } }, ...(number != null ? [{ number }] : [])];
  }
  if (params.suite) {
    // Filtering by a suite includes cases in its sub-suites, like browsing a tree.
    const suites = await db.suite.findMany({ where: { projectId: project.id }, select: { id: true, parentId: true, name: true } });
    where.suiteId = { in: descendantIds(suites, params.suite) };
  }
  if (params.priority) where.priority = params.priority;
  if (params.status) where.status = params.status;
  if (params.type) where.type = params.type;
  if (params.assignee === "none") where.assigneeId = null;
  else if (params.assignee) where.assigneeId = params.assignee;

  const dir: Prisma.SortOrder = params.dir === "asc" ? "asc" : "desc";
  const sort = SORTABLE.includes(params.sort as (typeof SORTABLE)[number]) ? params.sort : "updated";
  const pageSize = params.pageSize ?? 25;
  const total = await db.testCase.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, params.page ?? 1), pageCount);

  const select = {
    id: true,
    number: true,
    title: true,
    priority: true,
    status: true,
    type: true,
    archived: true,
    updatedAt: true,
    suite: { select: { id: true, name: true } },
    assignee: { select: { id: true, name: true } },
  } satisfies Prisma.TestCaseSelect;

  let items;
  if (sort === "priority") {
    // Priority is stored as text, so rank it in memory for a correct order.
    const all = await db.testCase.findMany({ where, select, orderBy: { number: "asc" } });
    all.sort((a, b) => ((PRIORITY_RANK[a.priority] ?? 0) - (PRIORITY_RANK[b.priority] ?? 0)) * (dir === "asc" ? 1 : -1));
    items = all.slice((page - 1) * pageSize, page * pageSize);
  } else {
    const orderBy: Prisma.TestCaseOrderByWithRelationInput =
      sort === "id" ? { number: dir } : sort === "title" ? { title: dir } : { updatedAt: dir };
    items = await db.testCase.findMany({
      where,
      select,
      orderBy: [orderBy, { number: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }
  return { items, total, page, pageCount, pageSize, sort, dir };
}
