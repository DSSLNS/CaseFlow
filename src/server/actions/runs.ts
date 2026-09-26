"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { ok, type ActionResult } from "@/lib/result";
import { resultSchema, runSchema } from "@/lib/validation";
import { getCurrentUser } from "../context";
import * as svc from "../services/runs";
import { parseOrFail, toFailure } from "./helpers";

async function revalidateProject(projectId: string) {
  const p = await db.project.findUnique({ where: { id: projectId }, select: { code: true } });
  if (p) revalidatePath(`/p/${p.code}`, "layout");
}

export async function createRun(input: unknown): Promise<ActionResult<{ id: string; caseCount: number }>> {
  const parsed = parseOrFail(runSchema, input);
  if (!parsed.ok) return parsed.result;
  try {
    const user = await getCurrentUser();
    const res = await svc.createRun(parsed.data, user?.id ?? null);
    await revalidateProject(parsed.data.projectId);
    return ok(res, `Test run started with ${res.caseCount} case(s)`);
  } catch (e) {
    return toFailure(e);
  }
}

export async function recordResult(projectId: string, input: unknown): Promise<ActionResult<{ status: string }>> {
  const parsed = parseOrFail(resultSchema, input);
  if (!parsed.ok) return parsed.result;
  try {
    const user = await getCurrentUser();
    const res = await svc.recordResult(projectId, parsed.data, user?.id ?? null);
    await revalidateProject(projectId);
    return ok({ status: res.status }, `Marked ${res.caseKey} as ${res.status}`);
  } catch (e) {
    return toFailure(e);
  }
}

export async function setRunStatus(projectId: string, runId: string, status: "Active" | "Completed"): Promise<ActionResult<null>> {
  try {
    await svc.setRunStatus(projectId, runId, status);
    await revalidateProject(projectId);
    return ok(null, status === "Completed" ? "Run completed" : "Run reopened");
  } catch (e) {
    return toFailure(e);
  }
}

export async function deleteRun(projectId: string, runId: string): Promise<ActionResult<null>> {
  try {
    await svc.deleteRun(projectId, runId);
    await revalidateProject(projectId);
    return ok(null, "Test run deleted");
  } catch (e) {
    return toFailure(e);
  }
}
