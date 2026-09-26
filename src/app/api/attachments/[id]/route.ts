import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readAttachmentFile } from "@/server/storage";

export async function GET(_request: Request, ctx: RouteContext<"/api/attachments/[id]">) {
  const { id } = await ctx.params;
  const att = await db.attachment.findUnique({ where: { id } });
  if (!att) return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  try {
    const bytes = await readAttachmentFile(att.id);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": att.mimeType,
        "Content-Length": String(bytes.length),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(att.filename)}`,
      },
    });
  } catch {
    return NextResponse.json({ error: "The stored file is missing." }, { status: 410 });
  }
}
