import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { CommitRequest, CommitResponse, DuplicateAction } from "@/lib/import/types";
import { ServiceError } from "../services/errors";
import { ensureSuitePath } from "../services/suites";
import { nextCaseNumber, setSteps, setTags } from "../services/test-cases";
import { loadProjectContext, validateImport } from "./validate";

type RowOutcome = { rowNumber: number; outcome: "created" | "updated" | "skipped" | "failed"; title: string; testCaseId?: string; caseKey?: string; message: string };

function toResponse(batch: { id: string; createdCount: number; updatedCount: number; skippedCount: number; failedCount: number }, replayed: boolean): CommitResponse {
  return {
    batchId: batch.id,
    replayed,
    created: batch.createdCount,
    updated: batch.updatedCount,
    skipped: batch.skippedCount,
    failed: batch.failedCount,
  };
}

export async function commitImport(req: CommitRequest, userId: string | null): Promise<CommitResponse> {
  if (!req.idempotencyKey || req.idempotencyKey.length > 100) throw new ServiceError("Missing import key.");

  const existing = await db.importBatch.findUnique({ where: { idempotencyKey: req.idempotencyKey } });
  if (existing) {
    if (existing.projectId !== req.projectId) throw new ServiceError("Import key belongs to another project.");
    return toResponse(existing, true);
  }

  // Never trust client-side validation: validate again against current data.
  const ctx = await loadProjectContext(req.projectId);
  const validation = await validateImport(req, ctx);

  // Claim the idempotency key before writing any cases so a concurrent duplicate
  // submission cannot import the same rows twice.
  let batch;
  try {
    batch = await db.importBatch.create({
      data: {
        projectId: req.projectId,
        idempotencyKey: req.idempotencyKey,
        filename: req.filename.slice(0, 255),
        fileSize: req.fileSize,
        fileHash: req.fileHash,
        status: "Processing",
        duplicateStrategy: req.options.duplicateStrategy,
        mapping: JSON.stringify(Object.fromEntries(req.headers.map((h, i) => [h, req.mapping[i] || "ignore"]))),
        totalRows: req.rows.length + req.blankRows,
        createdById: userId,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const again = await db.importBatch.findUnique({ where: { idempotencyKey: req.idempotencyKey } });
      if (again) return toResponse(again, true);
    }
    throw e;
  }

  const outcomes: RowOutcome[] = [];
  try {
    await db.$transaction(
      async (tx) => {
        const suiteCache = new Map<string, string>();
        for (const row of validation.rows) {
          const d = row.data;
          if (!row.valid) {
            outcomes.push({ rowNumber: row.rowNumber, outcome: "failed", title: d.title, message: row.errors.map((e) => e.message).join(" ") });
            continue;
          }

          let action: DuplicateAction = "create";
          if (row.duplicate) action = req.rowActions[row.rowNumber] ?? req.defaultDuplicateAction;
          else if (row.duplicateOfRow !== undefined) action = req.rowActions[row.rowNumber] === "skip" ? "skip" : "create";

          if (action === "skip") {
            outcomes.push({
              rowNumber: row.rowNumber,
              outcome: "skipped",
              title: d.title,
              caseKey: row.duplicate?.key,
              testCaseId: row.duplicate?.caseId,
              message: row.duplicate ? `Duplicate of ${row.duplicate.key}; skipped.` : `Duplicate of row ${row.duplicateOfRow}; skipped.`,
            });
            continue;
          }

          let suiteId = d.suiteId;
          if (!suiteId && d.suitePath) {
            const key = d.suitePath.join(" > ").toLowerCase();
            suiteId = suiteCache.get(key) ?? (await ensureSuitePath(tx, req.projectId, d.suitePath));
            suiteCache.set(key, suiteId);
          }
          if (!suiteId) throw new ServiceError(`Row ${row.rowNumber}: suite could not be resolved.`);

          if (action === "update" && row.duplicate) {
            if (row.duplicateOfRow !== undefined) {
              outcomes.push({ rowNumber: row.rowNumber, outcome: "skipped", title: d.title, caseKey: row.duplicate.key, testCaseId: row.duplicate.caseId, message: `Row ${row.duplicateOfRow} already updates ${row.duplicate.key}; skipped to avoid overwriting it twice.` });
              continue;
            }
            const has = (f: string) => d.present.includes(f);
            const data: Prisma.TestCaseUncheckedUpdateInput = { updatedById: userId };
            if (has("title")) data.title = d.title;
            if (has("suite") && d.suitePath) data.suiteId = suiteId;
            if (has("preconditions")) data.preconditions = d.preconditions;
            if (has("description")) data.description = d.description;
            if (has("priority")) data.priority = d.priority;
            if (has("status")) data.status = d.status;
            if (has("type")) data.type = d.type;
            if (has("severity")) data.severity = d.severity;
            if (has("assignee")) data.assigneeId = d.assigneeId;
            if (has("estimate")) data.estimateMinutes = d.estimateMinutes;
            if (has("automationStatus")) data.automationStatus = d.automationStatus;
            if (has("automationRef")) data.automationRef = d.automationRef;
            await tx.testCase.update({ where: { id: row.duplicate.caseId }, data });
            if (has("steps") || has("expectedResult")) await setSteps(tx, row.duplicate.caseId, d.steps);
            if (has("tags")) await setTags(tx, row.duplicate.caseId, req.projectId, d.tags);
            outcomes.push({ rowNumber: row.rowNumber, outcome: "updated", title: d.title, testCaseId: row.duplicate.caseId, caseKey: row.duplicate.key, message: `Updated ${row.duplicate.key}.` });
            continue;
          }

          const number = await nextCaseNumber(tx, req.projectId);
          const created = await tx.testCase.create({
            data: {
              projectId: req.projectId,
              number,
              suiteId,
              title: d.title,
              description: d.description,
              preconditions: d.preconditions,
              priority: d.priority,
              status: d.status,
              type: d.type,
              severity: d.severity,
              assigneeId: d.assigneeId,
              estimateMinutes: d.estimateMinutes,
              automationStatus: d.automationStatus,
              automationRef: d.automationRef,
              createdById: userId,
              updatedById: userId,
            },
          });
          await setSteps(tx, created.id, d.steps);
          await setTags(tx, created.id, req.projectId, d.tags);
          const key = `${ctx.project.code}-${number}`;
          outcomes.push({
            rowNumber: row.rowNumber,
            outcome: "created",
            title: d.title,
            testCaseId: created.id,
            caseKey: key,
            message: row.duplicate ? `Created as new; similar to ${row.duplicate.key}.` : "",
          });
        }
      },
      { timeout: 120_000, maxWait: 10_000 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    await db.importBatch.update({
      where: { id: batch.id },
      data: { status: "Failed", errorMessage: `Import rolled back; no test cases were changed. ${message}`.slice(0, 2000) },
    });
    throw new ServiceError(`Import failed and was rolled back; no test cases were changed. ${message}`);
  }

  const count = (o: RowOutcome["outcome"]) => outcomes.filter((x) => x.outcome === o).length;
  const updatedBatch = await db.importBatch.update({
    where: { id: batch.id },
    data: {
      status: "Completed",
      createdCount: count("created"),
      updatedCount: count("updated"),
      skippedCount: count("skipped"),
      failedCount: count("failed"),
      rows: {
        createMany: {
          data: outcomes.map((o) => ({
            rowNumber: o.rowNumber,
            outcome: o.outcome,
            title: o.title.slice(0, 255),
            testCaseId: o.testCaseId ?? null,
            caseKey: o.caseKey ?? "",
            message: o.message.slice(0, 2000),
          })),
        },
      },
    },
  });
  return toResponse(updatedBatch, false);
}
