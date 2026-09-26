/** Import target fields, shared by the client wizard and the server validator. */
export const IMPORT_FIELDS = [
  { key: "title", label: "Title", required: true, multi: false },
  { key: "suite", label: "Suite", required: false, multi: false, hint: 'Use "Parent > Child" for nested suites' },
  { key: "preconditions", label: "Preconditions", required: false, multi: false },
  { key: "description", label: "Description", required: false, multi: false },
  { key: "steps", label: "Steps", required: false, multi: true, hint: "Numbered text, or several step columns" },
  { key: "expectedResult", label: "Expected Result", required: false, multi: true },
  { key: "priority", label: "Priority", required: false, multi: false },
  { key: "status", label: "Status", required: false, multi: false },
  { key: "type", label: "Type", required: false, multi: false },
  { key: "severity", label: "Severity", required: false, multi: false },
  { key: "assignee", label: "Assignee", required: false, multi: false, hint: "User name or email" },
  { key: "tags", label: "Tags", required: false, multi: false, hint: "Comma or semicolon separated" },
  { key: "estimate", label: "Estimate", required: false, multi: false, hint: "e.g. 30m, 1h 30m, or minutes" },
  { key: "automationStatus", label: "Automation Status", required: false, multi: false },
  { key: "automationRef", label: "Automation Reference", required: false, multi: false },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];
/** "" = not decided yet, "ignore" = user chose not to import this column. */
export type MappingTarget = ImportFieldKey | "ignore" | "";
export type ColumnMapping = MappingTarget[];

export const FIELD_LABEL: Record<ImportFieldKey, string> = Object.fromEntries(
  IMPORT_FIELDS.map((f) => [f.key, f.label]),
) as Record<ImportFieldKey, string>;

const ALIASES: Record<ImportFieldKey, string[]> = {
  title: ["title", "test case", "test case title", "test case name", "case title", "name", "test name", "summary", "scenario", "test scenario", "test title"],
  suite: ["suite", "test suite", "suite name", "suite path", "section", "module", "folder", "component", "feature", "area"],
  preconditions: ["preconditions", "precondition", "pre conditions", "pre condition", "prerequisites", "prerequisite", "pre requisites", "setup"],
  description: ["description", "objective", "details", "purpose", "test description", "case description", "test case description"],
  steps: ["steps", "test steps", "step", "actions", "action", "procedure", "step description", "steps to reproduce", "test procedure", "testing steps"],
  expectedResult: ["expected result", "expected results", "expected", "expected outcome", "expected behavior", "expected behaviour", "result expected"],
  priority: ["priority", "prio"],
  status: ["status", "state", "case status"],
  type: ["type", "test type", "case type", "category", "scenario type"],
  severity: ["severity"],
  assignee: ["assignee", "assigned to", "owner", "tester", "responsible"],
  tags: ["tags", "tag", "labels", "label", "keywords"],
  estimate: ["estimate", "estimated time", "estimation", "duration", "time estimate", "est"],
  automationStatus: ["automation status", "automation", "automated", "is automated", "automation state"],
  automationRef: ["automation reference", "automation ref", "automation id", "automation link", "script", "test script", "automated test id"],
};

export function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/[_\-/]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function suggestField(header: string): ImportFieldKey | null {
  const n = normalizeHeader(header);
  if (!n) return null;
  if (/^(test )?step ?\d+$/.test(n) || /^step ?\d+ (action|description)$/.test(n)) return "steps";
  if (/^expected( results?)? ?\d+$/.test(n) || /^step ?\d+ expected( results?)?$/.test(n)) return "expectedResult";
  for (const [key, list] of Object.entries(ALIASES) as [ImportFieldKey, string[]][]) {
    if (list.includes(n)) return key;
  }
  return null;
}

/** Suggests a mapping; each single-value field is suggested at most once. */
export function autoMap(headers: string[]): ColumnMapping {
  const used = new Set<ImportFieldKey>();
  return headers.map((h) => {
    const f = suggestField(h);
    if (!f) return "";
    const def = IMPORT_FIELDS.find((x) => x.key === f)!;
    if (!def.multi && used.has(f)) return "";
    used.add(f);
    return f;
  });
}

export function mappingProblems(mapping: ColumnMapping): string[] {
  const problems: string[] = [];
  if (!mapping.includes("title")) problems.push("Map a column to Title — it is required.");
  for (const f of IMPORT_FIELDS) {
    if (!f.multi && mapping.filter((m) => m === f.key).length > 1) {
      problems.push(`${f.label} is mapped to more than one column.`);
    }
  }
  return problems;
}
