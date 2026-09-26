import "server-only";
import { NextResponse } from "next/server";
import { ServiceError } from "./services/errors";

export function jsonError(e: unknown) {
  if (e instanceof ServiceError) return NextResponse.json({ error: e.message }, { status: 400 });
  if (e instanceof SyntaxError) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  console.error(e);
  return NextResponse.json({ error: "Unexpected server error. Nothing was changed." }, { status: 500 });
}
