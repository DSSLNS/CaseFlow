"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, type ActionResult } from "@/lib/result";
import { projectSchema } from "@/lib/validation";
import { PROJECT_COOKIE } from "../context";
import { getSessionUser } from "../auth";
import { parseOrFail, toFailure } from "./helpers";

export async function createProject(input: unknown): Promise<ActionResult<{ code: string }>> {
  const parsed = parseOrFail(projectSchema, input);
  if (!parsed.ok) return parsed.result;
  try {
    if (await db.project.findUnique({ where: { code: parsed.data.code } })) {
      return fail("That project code is already in use.", { code: ["That project code is already in use."] });
    }
    const sessionUser = await getSessionUser();
    const p = await db.project.create({ data: parsed.data });
    // Every project starts with one suite so test cases can be created immediately.
    await db.suite.create({ data: { projectId: p.id, name: "General", position: 0 } });
    // Make the creator an owner of the project
    if (sessionUser) {
      await db.projectMember.create({
        data: { projectId: p.id, userId: sessionUser.id, role: "owner" },
      });
    }
    revalidatePath("/", "layout");
    return ok({ code: p.code }, `Project ${p.name} created`);
  } catch (e) {
    return toFailure(e);
  }
}

const settingsSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().max(2000),
  severities: z
    .array(z.string().trim().min(1).max(40))
    .min(1, "Keep at least one severity value")
    .max(20)
    .refine((a) => new Set(a.map((s) => s.toLowerCase())).size === a.length, "Severity values must be unique"),
});

export async function updateProjectSettings(input: unknown): Promise<ActionResult<null>> {
  const parsed = parseOrFail(settingsSchema, input);
  if (!parsed.ok) return parsed.result;
  const { projectId, name, description, severities } = parsed.data;
  try {
    const p = await db.project.update({
      where: { id: projectId },
      data: { name, description, severities: severities.join("\n") },
    });
    revalidatePath(`/p/${p.code}`, "layout");
    return ok(null, "Settings saved");
  } catch (e) {
    return toFailure(e);
  }
}

export async function deleteProject(projectId: string, confirmCode: string): Promise<ActionResult<null>> {
  try {
    const p = await db.project.findUnique({ where: { id: projectId } });
    if (!p) return fail("Project not found.");
    if (confirmCode.trim().toUpperCase() !== p.code) return fail(`Type ${p.code} to confirm.`);
    await db.$transaction(async (tx) => {
      // Test cases and suites use Restrict relations; remove them explicitly first.
      await tx.testCase.deleteMany({ where: { projectId } });
      const suites = await tx.suite.findMany({ where: { projectId }, select: { id: true, parentId: true } });
      let remaining = suites;
      while (remaining.length) {
        const parents = new Set(remaining.map((s) => s.parentId).filter(Boolean));
        const leaves = remaining.filter((s) => !parents.has(s.id));
        await tx.suite.deleteMany({ where: { id: { in: leaves.map((l) => l.id) } } });
        remaining = remaining.filter((s) => !leaves.includes(s));
      }
      await tx.project.delete({ where: { id: projectId } });
    });
    (await cookies()).delete(PROJECT_COOKIE);
    revalidatePath("/", "layout");
    return ok(null, `Project ${p.name} deleted`);
  } catch (e) {
    return toFailure(e);
  }
}

