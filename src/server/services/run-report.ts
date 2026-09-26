import "server-only";
import { db } from "@/lib/db";
import { emptyCounts, type RunCounts } from "./runs";

export type ReportEvidence = { kind: string; label: string; url: string; provider: string };
export type ReportRow = {
  runCaseId: string;
  executionId: string;
  caseKey: string;
  scenario: string;
  suite: string;
  result: string;
  tester: string;
  executedAt: string;
  notes: string;
  defect: string;
  evidence: ReportEvidence[];
};
export type HistoryRow = ReportRow & { attempt: number };

/** Builds the regression report from the stored executions (single source for page and exports). */
export async function buildRunReport(projectId: string, runId: string) {
  const run = await db.testRun.findFirst({
    where: { id: runId, projectId },
    include: {
      project: { select: { code: true, name: true } },
      owner: { select: { name: true } },
      cases: {
        orderBy: { position: "asc" },
        include: {
          executions: {
            orderBy: { createdAt: "asc" },
            include: { executedBy: { select: { name: true } }, evidence: { orderBy: { createdAt: "asc" } } },
          },
        },
      },
    },
  });
  if (!run) return null;

  const counts: RunCounts = emptyCounts();
  const rows: ReportRow[] = [];
  const history: HistoryRow[] = [];
  for (const c of run.cases) {
    counts.total++;
    counts[c.status as keyof Omit<RunCounts, "total">]++;
    const toRow = (e: (typeof c.executions)[number] | undefined): ReportRow => ({
      runCaseId: c.id,
      executionId: e?.id ?? "",
      caseKey: c.caseKey,
      scenario: c.title,
      suite: c.suiteName,
      result: e?.status ?? c.status,
      tester: e?.executedBy?.name ?? "",
      executedAt: e ? e.createdAt.toISOString() : "",
      notes: e?.comment ?? "",
      defect: e?.bugRef ?? "",
      evidence: (e?.evidence ?? []).map((v) => ({ kind: v.kind, label: v.label, url: v.url, provider: v.provider })),
    });
    rows.push(toRow(c.executions.at(-1)));
    c.executions.forEach((e, i) => history.push({ ...toRow(e), attempt: i + 1 }));
  }
  return { run, counts, rows, history };
}

export type RunReport = NonNullable<Awaited<ReturnType<typeof buildRunReport>>>;
