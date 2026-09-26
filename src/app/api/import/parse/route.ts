import { NextResponse } from "next/server";
import { parseImportFile } from "@/server/import/parse";
import { jsonError } from "@/server/http";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
    return NextResponse.json(await parseImportFile(file));
  } catch (e) {
    return jsonError(e);
  }
}
