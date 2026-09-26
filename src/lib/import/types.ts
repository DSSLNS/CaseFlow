import type { ColumnMapping } from "./fields";

export type SourceRow = { rowNumber: number; cells: string[]; issue?: string };

export type ParseResult = {
  filename: string;
  fileSize: number;
  fileHash: string;
  format: "csv" | "xlsx";
  sheetName?: string;
  headers: string[];
  rows: SourceRow[];
  blankRows: number[];
  malformedRows: { rowNumber: number; reason: string }[];
};

export type DuplicateStrategy = "project_title" | "suite_title" | "none";
export type DuplicateAction = "skip" | "update" | "create";

export type ImportOptions = {
  defaultSuiteId: string;
  createMissingSuites: boolean;
  duplicateStrategy: DuplicateStrategy;
};

export type RowMessage = { field: string; message: string };

export type NormalizedCase = {
  title: string;
  suitePath: string[] | null;
  suiteId: string | null;
  preconditions: string;
  description: string;
  steps: { action: string; expectedResult: string }[];
  priority: string;
  status: string;
  type: string;
  severity: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  tags: string[];
  estimateMinutes: number | null;
  automationStatus: string;
  automationRef: string;
  /** Fields that were mapped from the file (used for updates). */
  present: string[];
};

export type ValidatedRow = {
  rowNumber: number;
  valid: boolean;
  errors: RowMessage[];
  warnings: RowMessage[];
  data: NormalizedCase;
  duplicate?: { caseId: string; key: string; title: string };
  duplicateOfRow?: number;
};

export type ValidationSummary = {
  totalRows: number;
  blankRows: number;
  validRows: number;
  invalidRows: number;
  duplicates: number;
  suitesToCreate: string[];
};

export type ValidateRequest = {
  projectId: string;
  headers: string[];
  rows: SourceRow[];
  mapping: ColumnMapping;
  options: ImportOptions;
  fileHash?: string;
};

export type ValidateResponse = {
  rows: ValidatedRow[];
  summary: ValidationSummary;
  previousImports: { id: string; filename: string; createdAt: string; createdCount: number }[];
};

export type CommitRequest = ValidateRequest & {
  idempotencyKey: string;
  filename: string;
  fileSize: number;
  fileHash: string;
  blankRows: number;
  defaultDuplicateAction: DuplicateAction;
  rowActions: Record<number, DuplicateAction>;
};

export type CommitResponse = {
  batchId: string;
  replayed: boolean;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
};
