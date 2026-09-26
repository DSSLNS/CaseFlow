import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/common/page-header";
import { ResultBadge, RunStatusBadge } from "@/components/common/badges";
import { EvidenceList } from "@/components/runs/evidence";
import { RunProgressBar } from "@/components/runs/progress-bar";
import { formatDate, formatDateTime } from "@/lib/format";
import { getProjectByCode } from "@/server/context";
import { buildRunReport } from "@/server/services/run-report";

export const metadata: Metadata = { title: "Run report" };

export default async function RunReportPage({ params }: PageProps<"/p/[code]/runs/[runId]/report">) {
  const { code, runId } = await params;
  const project = await getProjectByCode(code);
  const report = await buildRunReport(project.id, runId);
  if (!report) notFound();
  const { run, counts, rows } = report;
  const base = `/p/${project.code}`;

  return (
    <>
      <PageHeader
        title={`${run.title} — report`}
        crumbs={[
          { label: project.name, href: `${base}/dashboard` },
          { label: "Test Runs", href: `${base}/runs` },
          { label: run.title, href: `${base}/runs/${run.id}` },
          { label: "Report" },
        ]}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`${base}/runs/${run.id}`}>
                <PlayCircle aria-hidden /> Open execution
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <a href={`/api/runs/${run.id}/export?format=csv`} download>
                <Download aria-hidden /> Export CSV
              </a>
            </Button>
            <Button asChild>
              <a href={`/api/runs/${run.id}/export?format=xlsx`} download>
                <Download aria-hidden /> Export XLSX
              </a>
            </Button>
          </>
        }
      />
      <Card className="mb-4">
        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-4" data-testid="report-meta">
            {(
              [
                ["Status", <RunStatusBadge key="s" value={run.status} />],
                ["Environment", run.environment || "—"],
                ["Build / version", run.buildVersion || "—"],
                ["Release / ticket", run.releaseRef || "—"],
                ["Execution date", run.executionDate ? formatDate(run.executionDate) : "—"],
                ["Tester", run.owner?.name ?? "—"],
                ["Suites", run.sourceSuites || "—"],
                ["Run ID", <code key="id" className="text-xs">{run.id}</code>],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {(["total", "Pass", "Fail", "Blocked", "Not Run"] as const).map((k) => (
              <div key={k} className="rounded-lg border px-3 py-2">
                <div className="text-xs text-muted-foreground">{k === "total" ? "Total cases" : <ResultBadge value={k} />}</div>
                <div className="mt-1 text-xl font-semibold tabular-nums" data-testid={`report-count-${k}`}>
                  {counts[k]}
                </div>
              </div>
            ))}
          </div>
          <RunProgressBar counts={counts} />
          {run.description && <p className="text-sm whitespace-pre-wrap text-muted-foreground">{run.description}</p>}
        </CardContent>
      </Card>
      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="py-4">
          <CardTitle className="text-sm">Results (latest execution per case)</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm" aria-label="Run results">
              <thead className="border-y bg-muted/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2">Test case ID</th>
                  <th scope="col" className="px-2 py-2">Scenario</th>
                  <th scope="col" className="px-2 py-2">Result</th>
                  <th scope="col" className="px-2 py-2">Tester</th>
                  <th scope="col" className="px-2 py-2">Executed</th>
                  <th scope="col" className="px-2 py-2">Notes</th>
                  <th scope="col" className="px-2 py-2">Defect</th>
                  <th scope="col" className="px-4 py-2">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.runCaseId} className="border-b align-top last:border-0" data-testid="report-row">
                    <td className="px-4 py-2 font-mono text-xs">{r.caseKey}</td>
                    <td className="max-w-[260px] px-2 py-2">
                      <Link href={`${base}/runs/${run.id}?case=${r.runCaseId}`} className="hover:underline">
                        {r.scenario}
                      </Link>
                    </td>
                    <td className="px-2 py-2">
                      <ResultBadge value={r.result} />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-muted-foreground">{r.tester || "—"}</td>
                    <td className="px-2 py-2 whitespace-nowrap text-muted-foreground">{r.executedAt ? formatDateTime(r.executedAt) : "—"}</td>
                    <td className="max-w-[240px] px-2 py-2 whitespace-pre-wrap">{r.notes || "—"}</td>
                    <td className="px-2 py-2">{r.defect || "—"}</td>
                    <td className="max-w-[300px] px-4 py-2">
                      <EvidenceList items={r.evidence.map((e, i) => ({ ...e, id: String(i) }))} empty="—" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        The XLSX export also contains every execution attempt (sheet “Execution history”). Exports include stable run, run-case and
        execution IDs. Google Sheets sync is not configured.
      </p>
    </>
  );
}
