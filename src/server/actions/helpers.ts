import "server-only";
import type { z } from "zod";
import { fail, type ActionResult } from "@/lib/result";
import { fieldErrorsOf } from "@/lib/validation";
import { ServiceError } from "../services/errors";

export function toFailure(e: unknown): ActionResult<never> {
  if (e instanceof ServiceError) return fail(e.message, e.field ? { [e.field]: [e.message] } : undefined);
  console.error(e);
  return fail("Something went wrong on the server. Nothing was saved.");
}

export function parseOrFail<S extends z.ZodType>(schema: S, input: unknown):
  | { ok: true; data: z.infer<S> }
  | { ok: false; result: ActionResult<never> } {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, result: fail("Please fix the highlighted fields.", fieldErrorsOf(parsed.error)) };
}
