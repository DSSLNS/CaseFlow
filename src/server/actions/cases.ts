"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { CASE_STATUSES, PRIORITIES } from "@/lib/constants";
import { ok, type ActionResult } from "@/lib/result";
import { testCaseSchema } from "@/lib/validation";
import { getCurrentUser } from "../context";
import * as svc from "../services/test-cases";
import { parseOrFail, toFailure } from "./helpers";

type Saved = { id: string; key: string; projectCode: string };

export async function saveTestCase(id: string | null, input: unknown): Promise<ActionResult<Saved>> {
  const parsed = parseOrFail(testCaseSchema, input);
  if (!parsed.ok) return parsed.result;
  try {
    const user = await getCurrentUser();
    const saved = id
      ? await svc.updateTestCase(id, parsed.data, user?.id ?? null)
      : await svc.createTestCase(parsed.data, user?.id ?? null);
    revalidatePath(`/p/${saved.projectCode}`, "layout");
    return ok(saved, id ? `${saved.key} updated` : `${saved.key} created`);
  } catch (e) {
    return toFailure(e);
  }
}

const idsSchema = z.array(z.string().min(1)).min(1, "Select at least one test case").max(1000);

async function projectCode(projectId: string) {
  const p = await db.project.findUnique({ where: { id: projectId }, select: { code: true } });
  return p?.code ?? "";
}

export async function duplicateTestCase(projectId: string, id: string): Promise<ActionResult<{ id: string; key: string }>> {
  try {
    const user = await getCurrentUser();
    const res = await svc.duplicateTestCase(projectId, id, user?.id ?? null);
    revalidatePath(`/p/${await projectCode(projectId)}`, "layout");
    return ok(res, `Duplicated as ${res.key}`);
  } catch (e) {
    return toFailure(e);
  }
}

export async function deleteTestCases(projectId: string, ids: string[]): Promise<ActionResult<number>> {
  const parsed = parseOrFail(idsSchema, ids);
  if (!parsed.ok) return parsed.result;
  try {
    const n = await svc.deleteTestCases(projectId, parsed.data);
    if (n === 0) return { ok: false, error: "No matching test cases were found; nothing was deleted." };
    revalidatePath(`/p/${await projectCode(projectId)}`, "layout");
    return ok(n, `Deleted ${n} test case${n === 1 ? "" : "s"}`);
  } catch (e) {
    return toFailure(e);
  }
}

export async function archiveTestCases(projectId: string, ids: string[], archived: boolean): Promise<ActionResult<number>> {
  const parsed = parseOrFail(idsSchema, ids);
  if (!parsed.ok) return parsed.result;
  try {
    const user = await getCurrentUser();
    const n = await svc.setArchived(projectId, parsed.data, archived, user?.id ?? null);
    revalidatePath(`/p/${await projectCode(projectId)}`, "layout");
    return ok(n, `${archived ? "Archived" : "Restored"} ${n} test case${n === 1 ? "" : "s"}`);
  } catch (e) {
    return toFailure(e);
  }
}

export async function moveTestCases(projectId: string, ids: string[], suiteId: string): Promise<ActionResult<number>> {
  const parsed = parseOrFail(idsSchema, ids);
  if (!parsed.ok) return parsed.result;
  try {
    const user = await getCurrentUser();
    const n = await svc.moveTestCases(projectId, parsed.data, suiteId, user?.id ?? null);
    revalidatePath(`/p/${await projectCode(projectId)}`, "layout");
    return ok(n, `Moved ${n} test case${n === 1 ? "" : "s"}`);
  } catch (e) {
    return toFailure(e);
  }
}

const bulkSchema = z.discriminatedUnion("field", [
  z.object({ field: z.literal("priority"), value: z.enum(PRIORITIES) }),
  z.object({ field: z.literal("status"), value: z.enum(CASE_STATUSES) }),
]);

export async function bulkUpdateTestCases(projectId: string, ids: string[], change: unknown): Promise<ActionResult<number>> {
  const parsedIds = parseOrFail(idsSchema, ids);
  if (!parsedIds.ok) return parsedIds.result;
  const parsed = parseOrFail(bulkSchema, change);
  if (!parsed.ok) return parsed.result;
  try {
    const user = await getCurrentUser();
    const n = await svc.bulkUpdateField(projectId, parsedIds.data, parsed.data.field, parsed.data.value, user?.id ?? null);
    revalidatePath(`/p/${await projectCode(projectId)}`, "layout");
    return ok(n, `Updated ${parsed.data.field} on ${n} test case${n === 1 ? "" : "s"}`);
  } catch (e) {
    return toFailure(e);
  }
}

export async function deleteAttachment(attachmentId: string): Promise<ActionResult<null>> {
  try {
    const att = await db.attachment.findUnique({ where: { id: attachmentId }, include: { testCase: { include: { project: true } } } });
    if (!att) return { ok: false, error: "Attachment not found." };
    await db.attachment.delete({ where: { id: attachmentId } });
    const { removeAttachmentFile } = await import("../storage");
    await removeAttachmentFile(attachmentId);
    revalidatePath(`/p/${att.testCase.project.code}`, "layout");
    return ok(null, `Removed ${att.filename}`);
  } catch (e) {
    return toFailure(e);
  }
}
