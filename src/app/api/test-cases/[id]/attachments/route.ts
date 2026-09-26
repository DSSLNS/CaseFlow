import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { MAX_ATTACHMENT_BYTES } from "@/lib/constants";
import { getCurrentUser } from "@/server/context";
import { jsonError } from "@/server/http";
import { removeAttachmentFile, saveAttachmentFile } from "@/server/storage";

export async function POST(request: Request, ctx: RouteContext<"/api/test-cases/[id]/attachments">) {
  try {
    const { id } = await ctx.params;
    const testCase = await db.testCase.findUnique({ where: { id }, include: { project: true } });
    if (!testCase) return NextResponse.json({ error: "Test case not found." }, { status: 404 });
    const form = await request.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (!files.length) return NextResponse.json({ error: "No files were uploaded." }, { status: 400 });
    const tooBig = files.find((f) => f.size > MAX_ATTACHMENT_BYTES);
    if (tooBig) {
      return NextResponse.json({ error: `${tooBig.name} is larger than ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB.` }, { status: 400 });
    }
    const user = await getCurrentUser();
    const saved = [];
    for (const file of files) {
      const att = await db.attachment.create({
        data: {
          testCaseId: id,
          filename: file.name.slice(0, 255),
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          uploadedById: user?.id ?? null,
        },
      });
      try {
        await saveAttachmentFile(att.id, Buffer.from(await file.arrayBuffer()));
      } catch (err) {
        await db.attachment.delete({ where: { id: att.id } });
        await removeAttachmentFile(att.id);
        throw err;
      }
      saved.push({ id: att.id, filename: att.filename, size: att.size });
    }
    revalidatePath(`/p/${testCase.project.code}`, "layout");
    return NextResponse.json({ attachments: saved });
  } catch (e) {
    return jsonError(e);
  }
}
