import "server-only";
import { db } from "@/lib/db";
import { DEFAULTS, parseSeverities } from "@/lib/constants";
import { formatEstimate } from "@/lib/estimate";
import { flattenTree } from "@/lib/suite-tree";
import type { TestCaseInput } from "@/lib/validation";
import type { CaseDetail } from "./services/test-cases";

export async function loadFormProjects() {
  const projects = await db.project.findMany({
    orderBy: { name: "asc" },
    include: { suites: { select: { id: true, name: true, parentId: true, position: true } } },
  });
  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    severities: parseSeverities(p.severities),
    suites: flattenTree(p.suites),
  }));
}

export function emptyCaseInput(projectId: string, suiteId: string): TestCaseInput {
  return {
    projectId,
    suiteId,
    title: "",
    description: "",
    preconditions: "",
    steps: [{ action: "", expectedResult: "" }],
    priority: DEFAULTS.priority,
    status: DEFAULTS.status,
    type: DEFAULTS.type,
    severity: "",
    assigneeId: "",
    tags: [],
    estimate: "",
    automationStatus: DEFAULTS.automationStatus,
    automationRef: "",
  };
}

export function caseToInput(c: CaseDetail): TestCaseInput {
  return {
    projectId: c.projectId,
    suiteId: c.suiteId,
    title: c.title,
    description: c.description,
    preconditions: c.preconditions,
    steps: c.steps.map((s) => ({ action: s.action, expectedResult: s.expectedResult })),
    priority: c.priority as TestCaseInput["priority"],
    status: c.status as TestCaseInput["status"],
    type: c.type as TestCaseInput["type"],
    severity: c.severity ?? "",
    assigneeId: c.assigneeId ?? "",
    tags: c.tags.map((t) => t.tag.name),
    estimate: formatEstimate(c.estimateMinutes),
    automationStatus: c.automationStatus as TestCaseInput["automationStatus"],
    automationRef: c.automationRef,
  };
}
