import { NextResponse } from "next/server";
import type { ValidateRequest } from "@/lib/import/types";
import { validateImport } from "@/server/import/validate";
import { jsonError } from "@/server/http";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ValidateRequest;
    return NextResponse.json(await validateImport(body));
  } catch (e) {
    return jsonError(e);
  }
}
