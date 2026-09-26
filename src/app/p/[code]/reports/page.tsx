import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/common/page-header";
import { BarList } from "@/components/common/bar-list";
import { RunStatusBadge } from "@/components/common/badges";
import { RunCountsInline, RunProgressBar } from "@/components/runs/progress-bar";
import { AUTOMATION_STATUSES, CASE_STATUSES, CASE_TYPES, PRIORITIES } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { buildTree, descendantIds } from "@/lib/suite-tree";
import { getProjectByCode } from "@/server/context";
import { listRuns } from "@/server/services/runs";

export const metadata: Metadata = { title: "Reports" };

async function groupCount(projectId: string, by: "priority" | "status" | "type" | "automationStatus", order: readonly string[]) {
  const rows = await db.testCase.groupBy({ by: [by], where: { projectId, archived: false }, _count: { _all: true } });
  const map = new Map(rows.map((r) => [r[by] as string, r._count._all]));
  return order.map((name) => ({ name, value: map.get(name) ?? 0 }));
}

export default async function ReportsPage({ params }: PageProps<"/p/[code]/reports">) {
  const { code } = await params;
  const project = await getProjectByCode(code);
  const [byPriority, byStatus, byType, byAutomation, runs, suites, suiteCounts] = await Promise.all([
    groupCount(project.id, "priority", PRIORITIES),
    groupCount(project.id, "status", CASE_STATUSES),
    groupCount(project.id, "type", CASE_TYPES),
    groupCount(project.id, "automationStatus", AUTOMATION_STATUSES),
    listRuns(project.id),
    db.suite.findMany({ where: { projectId: project.id }, select: { id: true, name: true, parentId: true, position: true } }),
    db.testCase.groupBy({ by: ["suiteId"], where: { projectId: project.id, archived: false }, _count: { _all: true } }),
  ]);
  const total = byStatus.reduce((s, i) => s + i.value, 0);
  const automated = byAutomation.find((a) => a.name === "Automated")?.value ?? 0;
  const direct = new Map(suiteCounts.map((s) => [s.suiteId, s._count._all]));
  const bySuite = buildTree(suites).map((root) => ({
    name: root.name,
    value: descendantIds(suites, root.id).reduce((s, id) => s + (direct.get(id) ?? 0), 0),
  }));
  const executed = runs.reduce((s, r) => s + r.counts.total - r.counts["Not Run"], 0);
  const base = `/p/${project.code}`;

  return (
    <>
      <PageHeader
        title="Reports"
        description="Live figures from the database. Archived test cases are excluded."
        crumbs={[{ label: project.name, href: `${base}/dashboard` }, { label: "Reports" }]}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Active test cases", total],
          ["Automation coverage", total ? `${Math.round((automated / total) * 100)}%` : "—"],
          ["Test runs", runs.length],
          ["Results recorded", executed],
        ].map(([l, v]) => (
          <Card key={l} className="gap-1 py-4">
            <CardContent className="px-4">
              <div className="text-xs text-muted-foreground">{l}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{v}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-4 gap-0 py-0">
        <CardHeader className="py-4">
          <CardTitle className="text-sm">Run history</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {runs.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm" aria-label="Run history">
                <thead className="border-y bg-muted/60 text-left text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2">Run</th>
                    <th scope="col" className="px-2 py-2">Started</th>
                    <th scope="col" className="px-2 py-2">Status</th>
                    <th scope="col" className="px-2 py-2">Results</th>
                    <th scope="col" className="w-48 px-2 py-2">Executed</th>
                    <th scope="col" className="px-4 py-2 text-right">Pass rate</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-4 py-2">
                        <Link href={`${base}/runs/${r.id}`} className="font-medium hover:underline">
                          {r.title}
                        </Link>
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-muted-foreground">{formatDate(r.createdAt)}</td>
                      <td className="px-2 py-2">
                        <RunStatusBadge value={r.status} />
                      </td>
                      <td className="px-2 py-2">
                        <RunCountsInline counts={r.counts} />
                      </td>
                      <td className="px-2 py-2">
                        <RunProgressBar counts={r.counts} />
                      </td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums">
                        {r.counts.total ? `${Math.round((r.counts.Pass / r.counts.total) * 100)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-4 pb-4 text-sm text-muted-foreground">No runs yet.</p>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {(
          [
            ["Cases by priority", byPriority],
            ["Cases by status", byStatus],
            ["Cases by type", byType],
            ["Automation status", byAutomation],
            ["Cases by top-level suite", bySuite],
          ] as const
        ).map(([title, items]) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle className="text-sm">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <BarList items={[...items]} label={title} />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
