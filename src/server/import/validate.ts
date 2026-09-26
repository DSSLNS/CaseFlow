import "server-only";
import { db } from "@/lib/db";
import {
  AUTOMATION_STATUSES,
  CASE_STATUSES,
  CASE_TYPES,
  DEFAULTS,
  parseSeverities,
  PRIORITIES,
} from "@/lib/constants";
import { parseEstimate } from "@/lib/estimate";
import { FIELD_LABEL, mappingProblems, type ImportFieldKey } from "@/lib/import/fields";
import type {
  NormalizedCase,
  RowMessage,
  ValidateRequest,
  ValidateResponse,
  ValidatedRow,
} from "@/lib/import/types";
import { pairStepColumns, pairStepText } from "@/lib/steps-parser";
import { flattenTree } from "@/lib/suite-tree";
import { ServiceError } from "../services/errors";

const norm = (v: string) => v.toLowerCase().replace(/[\s_\-]+/g, " ").trim();

/** Case/spacing-insensitive enum match plus a few unambiguous legacy spellings. */
function matchEnum(value: string, allowed: readonly string[], synonyms: Record<string, string> = {}): string | null {
  const n = norm(value);
  const direct = allowed.find((a) => norm(a) === n);
  if (direct) return direct;
  return synonyms[n] ?? null;
}

const AUTOMATION_SYNONYMS: Record<string, string> = {
  yes: "Automated",
  true: "Automated",
  no: "Not Automated",
  false: "Not Automated",
  "to be automated": "To Automate",
};

export async function loadProjectContext(projectId: string) {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) throw new ServiceError("Project not found.");
  const [suites, users] = await Promise.all([
    db.suite.findMany({ where: { projectId }, select: { id: true, name: true, parentId: true, position: true } }),
    db.user.findMany({ select: { id: true, name: true, email: true } }),
  ]);
  return { project, suites, users };
}

type Ctx = Awaited<ReturnType<typeof loadProjectContext>>;

export async function validateImport(req: ValidateRequest, ctx?: Ctx): Promise<ValidateResponse> {
  const problems = mappingProblems(req.mapping);
  if (problems.length) throw new ServiceError(problems.join(" "));
  if (req.mapping.length !== req.headers.length) throw new ServiceError("Column mapping does not match the file's columns.");

  const { project, suites, users } = ctx ?? (await loadProjectContext(req.projectId));
  const severities = parseSeverities(project.severities);
  const flat = flattenTree(suites);
  const suiteByPath = new Map(flat.map((s) => [s.path.toLowerCase(), s.id]));
  const defaultSuite = req.options.defaultSuiteId ? flat.find((s) => s.id === req.options.defaultSuiteId) : undefined;
  if (req.options.defaultSuiteId && !defaultSuite) throw new ServiceError("The default suite does not belong to this project.");

  const cols = (field: ImportFieldKey) =>
    req.mapping.flatMap((m, i) => (m === field ? [i] : []));
  const single = (field: ImportFieldKey) => cols(field)[0];
  const present = [...new Set(req.mapping.filter((m) => m && m !== "ignore"))] as string[];

  const suitesToCreate = new Set<string>();
  const out: ValidatedRow[] = [];

  for (const row of req.rows) {
    const errors: RowMessage[] = [];
    const warnings: RowMessage[] = [];
    const get = (field: ImportFieldKey) => {
      const i = single(field);
      return i === undefined ? "" : (row.cells[i] ?? "");
    };
    if (row.issue) errors.push({ field: "row", message: row.issue });

    // Title
    const title = get("title").trim();
    if (!title) errors.push({ field: "title", message: "Title is required." });
    else if (title.length > 255) errors.push({ field: "title", message: "Title is longer than 255 characters." });

    // Suite
    let suiteId: string | null = null;
    let suitePath: string[] | null = null;
    const suiteRaw = get("suite").trim();
    if (suiteRaw) {
      suitePath = suiteRaw.split(">").map((p) => p.trim()).filter(Boolean);
      const key = suitePath.join(" > ").toLowerCase();
      suiteId = suiteByPath.get(key) ?? null;
      if (!suiteId) {
        if (suitePath.some((p) => p.length > 120)) {
          errors.push({ field: "suite", message: "Suite names must be 120 characters or fewer." });
        } else if (req.options.createMissingSuites) {
          warnings.push({ field: "suite", message: `Suite "${suitePath.join(" > ")}" does not exist and will be created.` });
        } else {
          errors.push({ field: "suite", message: `Unknown suite "${suiteRaw}". Create it, enable "Create missing suites", or correct the value.` });
        }
      }
    } else if (defaultSuite) {
      suiteId = defaultSuite.id;
    } else {
      errors.push({ field: "suite", message: "No suite value and no default suite selected." });
    }

    // Steps / expected results
    let steps: NormalizedCase["steps"] = [];
    const stepCols = cols("steps");
    const expCols = cols("expectedResult");
    if (stepCols.length || expCols.length) {
      const pair =
        stepCols.length <= 1 && expCols.length <= 1
          ? pairStepText(stepCols.length ? row.cells[stepCols[0]] ?? "" : "", expCols.length ? row.cells[expCols[0]] ?? "" : "")
          : pairStepColumns(stepCols.map((i) => row.cells[i] ?? ""), expCols.map((i) => row.cells[i] ?? ""));
      if (pair.ok) {
        steps = pair.steps;
        if (steps.length > 100) errors.push({ field: "steps", message: "More than 100 steps." });
      } else {
        errors.push({ field: "steps", message: pair.error });
      }
    }

    // Enums: blank -> default (reported), invalid -> error
    const enumField = (field: ImportFieldKey, allowed: readonly string[], def: string, syn?: Record<string, string>) => {
      const raw = get(field).trim();
      if (!raw) return def;
      const m = matchEnum(raw, allowed, syn);
      if (!m) {
        errors.push({ field, message: `"${raw}" is not a valid ${FIELD_LABEL[field].toLowerCase()}. Allowed: ${allowed.join(", ")}.` });
        return def;
      }
      return m;
    };
    const priority = enumField("priority", PRIORITIES, DEFAULTS.priority);
    const status = enumField("status", CASE_STATUSES, DEFAULTS.status);
    const type = enumField("type", CASE_TYPES, DEFAULTS.type);
    const automationStatus = enumField("automationStatus", AUTOMATION_STATUSES, DEFAULTS.automationStatus, AUTOMATION_SYNONYMS);

    // Severity (project-configurable)
    let severity: string | null = null;
    const sevRaw = get("severity").trim();
    if (sevRaw) {
      severity = matchEnum(sevRaw, severities);
      if (!severity) errors.push({ field: "severity", message: `"${sevRaw}" is not a configured severity. Allowed: ${severities.join(", ")}.` });
    }

    // Assignee (name or email)
    let assigneeId: string | null = null;
    let assigneeName: string | null = null;
    const asgRaw = get("assignee").trim();
    if (asgRaw) {
      const n = asgRaw.toLowerCase();
      const u = users.find((x) => x.email.toLowerCase() === n || x.name.toLowerCase() === n);
      if (u) {
        assigneeId = u.id;
        assigneeName = u.name;
      } else errors.push({ field: "assignee", message: `No user matches "${asgRaw}".` });
    }

    // Tags
    const tags = [
      ...new Map(
        get("tags")
          .split(/[,;\n]/)
          .map((t) => t.trim())
          .filter(Boolean)
          .map((t) => [t.toLowerCase(), t]),
      ).values(),
    ];
    if (tags.some((t) => t.length > 50)) errors.push({ field: "tags", message: "Tags must be 50 characters or fewer." });
    if (tags.length > 20) errors.push({ field: "tags", message: "At most 20 tags per case." });

    // Estimate
    const estRaw = get("estimate").trim();
    const est = parseEstimate(estRaw);
    if (est === undefined) errors.push({ field: "estimate", message: `"${estRaw}" is not a valid estimate. Use 30m, 1h 30m, or minutes.` });

    const automationRef = get("automationRef").trim();
    if (automationRef.length > 500) errors.push({ field: "automationRef", message: "Automation reference is longer than 500 characters." });

    const preconditions = get("preconditions").trim();
    const description = get("description").trim();
    if (preconditions.length > 10000) errors.push({ field: "preconditions", message: "Preconditions are too long." });
    if (description.length > 10000) errors.push({ field: "description", message: "Description is too long." });

    out.push({
      rowNumber: row.rowNumber,
      valid: errors.length === 0,
      errors,
      warnings,
      data: {
        title,
        suitePath,
        suiteId,
        preconditions,
        description,
        steps,
        priority,
        status,
        type,
        severity,
        assigneeId,
        assigneeName,
        tags,
        estimateMinutes: est ?? null,
        automationStatus,
        automationRef,
        present,
      },
    });
  }

  // Only rows that can actually be imported cause new suites to be created.
  for (const r of out) {
    if (r.valid && !r.data.suiteId && r.data.suitePath) suitesToCreate.add(r.data.suitePath.join(" > "));
  }

  // Duplicate detection
  if (req.options.duplicateStrategy !== "none") {
    const bySuite = req.options.duplicateStrategy === "suite_title";
    const existing = await db.testCase.findMany({
      where: { projectId: project.id, title: { in: [...new Set(out.map((r) => r.data.title).filter(Boolean))] } },
      select: { id: true, number: true, title: true, suiteId: true },
      orderBy: { number: "asc" },
    });
    const keyOf = (title: string, suiteKey: string | null) =>
      bySuite ? `${suiteKey ?? ""}::${title.toLowerCase()}` : title.toLowerCase();
    const existingMap = new Map<string, (typeof existing)[number]>();
    for (const c of existing) {
      const k = keyOf(c.title, c.suiteId);
      if (!existingMap.has(k)) existingMap.set(k, c);
    }
    const seenInFile = new Map<string, number>();
    for (const r of out) {
      if (!r.data.title) continue;
      const suiteKey = r.data.suiteId ?? (r.data.suitePath ? `new:${r.data.suitePath.join(">").toLowerCase()}` : null);
      const k = keyOf(r.data.title, suiteKey);
      const match = existingMap.get(k);
      if (match) {
        r.duplicate = { caseId: match.id, key: `${project.code}-${match.number}`, title: match.title };
      }
      const earlier = seenInFile.get(k);
      if (earlier !== undefined) {
        r.duplicateOfRow = earlier;
        r.warnings.push({ field: "title", message: `Same title as row ${earlier} in this file.` });
      } else seenInFile.set(k, r.rowNumber);
    }
  }

  const previous = req.fileHash
    ? await db.importBatch.findMany({
        where: { projectId: project.id, fileHash: req.fileHash, status: "Completed" },
        orderBy: { createdAt: "desc" },
        select: { id: true, filename: true, createdAt: true, createdCount: true },
      })
    : [];

  return {
    rows: out,
    summary: {
      totalRows: out.length,
      blankRows: 0,
      validRows: out.filter((r) => r.valid).length,
      invalidRows: out.filter((r) => !r.valid).length,
      duplicates: out.filter((r) => r.duplicate || r.duplicateOfRow !== undefined).length,
      suitesToCreate: [...suitesToCreate],
    },
    previousImports: previous.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
  };
}
