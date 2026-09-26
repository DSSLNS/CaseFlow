"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, type ActionResult } from "@/lib/result";
import { suiteSchema } from "@/lib/validation";
import * as svc from "../services/suites";
import { parseOrFail, toFailure } from "./helpers";

async function revalidateProject(projectId: string) {
  const p = await db.project.findUnique({ where: { id: projectId }, select: { code: true } });
  if (p) revalidatePath(`/p/${p.code}`, "layout");
}

export async function saveSuite(id: string | null, input: unknown): Promise<ActionResult<{ id: string; name: string }>> {
  const parsed = parseOrFail(suiteSchema, input);
  if (!parsed.ok) return parsed.result;
  const data = { ...parsed.data, parentId: parsed.data.parentId || null };
  try {
    const suite = id ? await svc.updateSuite(id, data) : await svc.createSuite(data);
    await revalidateProject(data.projectId);
    return ok({ id: suite.id, name: suite.name }, id ? `Suite "${suite.name}" updated` : `Suite "${suite.name}" created`);
  } catch (e) {
    return toFailure(e);
  }
}

const deleteSchema = z.object({
  projectId: z.string().min(1),
  id: z.string().min(1),
  mode: z.enum(["block", "move", "delete"]),
  targetSuiteId: z.string().optional(),
});

export async function deleteSuite(input: unknown): Promise<ActionResult<{ deletedSuites: number; affectedCases: number }>> {
  const parsed = parseOrFail(deleteSchema, input);
  if (!parsed.ok) return parsed.result;
  const { projectId, id, mode, targetSuiteId } = parsed.data;
  try {
    const res = await svc.deleteSuite(projectId, id, mode, targetSuiteId);
    await revalidateProject(projectId);
    const extra =
      res.affectedCases === 0 ? "" : mode === "move" ? `; moved ${res.affectedCases} test case(s)` : `; deleted ${res.affectedCases} test case(s)`;
    return ok(res, `Deleted ${res.deletedSuites} suite(s)${extra}`);
  } catch (e) {
    return toFailure(e);
  }
}
