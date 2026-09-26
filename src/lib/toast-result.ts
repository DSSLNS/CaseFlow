"use client";

import { toast } from "sonner";
import type { ActionResult } from "./result";

/** Shows the real outcome of an action. Returns the result for chaining. */
export function toastResult<T>(res: ActionResult<T>): ActionResult<T> {
  if (res.ok) {
    if (res.message) toast.success(res.message);
  } else {
    toast.error(res.error);
  }
  return res;
}
