import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { CommitRequest } from "@/lib/import/types";
import { getCurrentUser } from "@/server/context";
import { commitImport } from "@/server/import/commit";
import { jsonError } from "@/server/http";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CommitRequest;
    const user = await getCurrentUser();
    const result = await commitImport(body, user?.id ?? null);
    const project = await db.project.findUnique({ where: { id: body.projectId }, select: { code: true } });
    if (project) revalidatePath(`/p/${project.code}`, "layout");
    return NextResponse.json(result);
  } catch (e) {
    return jsonError(e);
  }
}
