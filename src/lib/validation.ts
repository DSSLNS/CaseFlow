import { z } from "zod";
import { AUTOMATION_STATUSES, CASE_STATUSES, CASE_TYPES, PRIORITIES, RESULT_STATUSES } from "./constants";
import { parseEstimate } from "./estimate";

export const stepSchema = z.object({
  action: z.string().trim().min(1, "Step action is required").max(5000, "Step action is too long"),
  expectedResult: z.string().trim().max(5000, "Expected result is too long"),
});

export const testCaseSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  suiteId: z.string().min(1, "Suite is required"),
  title: z.string().trim().min(1, "Title is required").max(255, "Title must be 255 characters or fewer"),
  description: z.string().max(10000, "Description is too long"),
  preconditions: z.string().max(10000, "Preconditions are too long"),
  steps: z.array(stepSchema).max(100, "A test case can have at most 100 steps"),
  priority: z.enum(PRIORITIES, { message: "Choose a priority" }),
  status: z.enum(CASE_STATUSES, { message: "Choose a status" }),
  type: z.enum(CASE_TYPES, { message: "Choose a type" }),
  severity: z.string(),
  assigneeId: z.string(),
  tags: z
    .array(z.string().trim().min(1).max(50, "Tags must be 50 characters or fewer"))
    .max(20, "At most 20 tags"),
  estimate: z
    .string()
    .refine((v) => parseEstimate(v) !== undefined, "Use a duration like 30m, 1h or 1h 30m"),
  automationStatus: z.enum(AUTOMATION_STATUSES, { message: "Choose an automation status" }),
  automationRef: z.string().trim().max(500, "Automation reference is too long"),
});

export type TestCaseInput = z.infer<typeof testCaseSchema>;

export const suiteSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(120, "Name must be 120 characters or fewer"),
  description: z.string().max(2000, "Description is too long"),
  parentId: z.string(),
});
export type SuiteInput = z.infer<typeof suiteSchema>;

export const projectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9]{1,9}$/, "2–10 letters/digits, starting with a letter"),
  description: z.string().max(2000),
});
export type ProjectInput = z.infer<typeof projectSchema>;

export const runSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(1, "Run name is required").max(200),
  description: z.string().max(5000),
  ownerId: z.string(),
  environment: z.string().trim().max(100),
  buildVersion: z.string().trim().max(100),
  releaseRef: z.string().trim().max(200),
  executionDate: z.string().refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a valid date"),
  suiteIds: z.array(z.string()).max(500),
  caseIds: z.array(z.string()).min(1, "Select at least one test case"),
});
export type RunInput = z.infer<typeof runSchema>;

export const EVIDENCE_KINDS = ["screenshot", "recording", "log", "link"] as const;

export const evidenceItemSchema = z.object({
  kind: z.enum(EVIDENCE_KINDS),
  label: z.string().trim().max(200),
  url: z
    .string()
    .trim()
    .min(1, "Enter the evidence URL")
    .max(2000)
    .refine((v) => /^https?:\/\/\S+$/i.test(v), "Enter a full http(s) URL"),
});

export const resultSchema = z.object({
  runCaseId: z.string().min(1),
  status: z.enum(RESULT_STATUSES),
  comment: z.string().max(10000),
  bugRef: z.string().trim().max(200),
  evidence: z.array(evidenceItemSchema).max(20, "At most 20 evidence items per execution"),
});
export type ResultInput = z.infer<typeof resultSchema>;

export function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
