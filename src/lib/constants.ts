export const PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
export const CASE_STATUSES = ["Draft", "Ready", "Deprecated"] as const;
export const CASE_TYPES = [
  "Functional",
  "Regression",
  "Smoke",
  "Integration",
  "UI",
  "API",
  "Performance",
  "Security",
  "Other",
] as const;
export const AUTOMATION_STATUSES = ["Not Automated", "Automated", "To Automate"] as const;
export const RESULT_STATUSES = ["Pass", "Fail", "Blocked", "Not Run"] as const;
export const RUN_STATUSES = ["Active", "Completed"] as const;

export type Priority = (typeof PRIORITIES)[number];
export type CaseStatus = (typeof CASE_STATUSES)[number];
export type CaseType = (typeof CASE_TYPES)[number];
export type AutomationStatus = (typeof AUTOMATION_STATUSES)[number];
export type ResultStatus = (typeof RESULT_STATUSES)[number];

export const DEFAULTS = {
  priority: "Medium" as Priority,
  status: "Draft" as CaseStatus,
  type: "Functional" as CaseType,
  automationStatus: "Not Automated" as AutomationStatus,
};

export const PRIORITY_RANK: Record<string, number> = { Low: 0, Medium: 1, High: 2, Critical: 3 };

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export function parseSeverities(raw: string): string[] {
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}
