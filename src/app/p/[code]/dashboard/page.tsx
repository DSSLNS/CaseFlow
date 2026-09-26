import Link from "next/link";
import type { Metadata } from "next";
import { FileUp, FolderPlus, Info, ListChecks, PlayCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { PriorityBadge, ResultBadge, RunStatusBadge, StatusBadge } from "@/components/common/badges";
import { RunCountsInline, RunProgressBar } from "@/components/runs/progress-bar";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { getProjectByCode } from "@/server/context";
import { listRuns } from "@/server/services/runs";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ params }: PageProps<"/p/[code]/dashboard">) {
  const { code } = await params;
  const project = await getProjectByCode(code);
  const [caseCount, suiteCount, runs, recentCases] = await Promise.all([
    db.testCase.count({ where: { projectId: project.id, archived: false } }),
    db.suite.count({ where: { projectId: project.id } }),
    listRuns(project.id, 5),
    db.testCase.findMany({
      where: { projectId: project.id, archived: false },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { id: true, number: true, title: true, priority: true, status: true, updatedAt: true, updatedBy: { select: { name: true } } },
    }),
  ]);
  const latest = runs[0];
  const base = `/p/${project.code}`;

  const stats = [
    { label: "Test cases", value: caseCount, href: `${base}/cases` },
    { label: "Suites", value: suiteCount, href: `${base}/suites` },
    { label: "Test runs", value: await db.testRun.count({ where: { projectId: project.id } }), href: `${base}/runs` },
    {
      label: "Latest run pass rate",
      value: latest && latest.counts.total ? `${Math.round((latest.counts.Pass / latest.counts.total) * 100)}%` : "—",
      href: latest ? `${base}/runs/${latest.id}` : `${base}/runs`,
    },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={project.description || `Overview of ${project.name}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`${base}/import`}>
                <FileUp aria-hidden /> Import
              </Link>
            </Button>
            <Button asChild>
              <Link href={`${base}/cases/new`}>
                <Plus aria-hidden /> Create test case
              </Link>
            </Button>
          </>
        }
      />

      {project.isSample && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            This project contains <strong>sample data</strong> created by the seed script. Everything you create, edit, import, or
            execute here is saved to the database.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="group rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Card className="gap-1 py-4 transition-colors group-hover:border-primary/40">
              <CardContent className="px-4">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums" data-testid={`stat-${s.label}`}>
                  {s.value}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Latest test run</CardTitle>
            {latest && (
              <Button variant="ghost" size="sm" asChild>
                <Link href={`${base}/runs/${latest.id}`}>Open run</Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {latest ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{latest.title}</span>
                  <RunStatusBadge value={latest.status} />
                  <span className="text-xs text-muted-foreground">started {timeAgo(latest.createdAt)}</span>
                </div>
                <RunProgressBar counts={latest.counts} />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(["Pass", "Fail", "Blocked", "Not Run"] as const).map((s) => (
                    <div key={s} className="rounded-lg border px-3 py-2">
                      <ResultBadge value={s} />
                      <div className="mt-1 text-xl font-semibold tabular-nums" data-testid={`latest-${s}`}>
                        {latest.counts[s]}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={PlayCircle}
                title="No test runs yet"
                description="Start a run to execute test cases and record results."
                action={
                  <Button size="sm" asChild>
                    <Link href={`${base}/runs/new`}>Start test run</Link>
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button variant="outline" className="justify-start" asChild>
              <Link href={`${base}/cases/new`}>
                <Plus aria-hidden /> Create test case
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href={`${base}/suites?new=1`}>
                <FolderPlus aria-hidden /> Create suite
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href={`${base}/import`}>
                <FileUp aria-hidden /> Import test cases
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href={`${base}/runs/new`}>
                <PlayCircle aria-hidden /> Start test run
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Recently updated test cases</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {recentCases.length ? (
              <ul className="divide-y">
                {recentCases.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`${base}/cases/${project.code}-${c.number}`}
                      className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/60"
                    >
                      <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">
                        {project.code}-{c.number}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{c.title}</span>
                      <span className="hidden sm:inline">
                        <PriorityBadge value={c.priority} />
                      </span>
                      <StatusBadge value={c.status} />
                      <span className="hidden w-28 text-right text-xs text-muted-foreground md:inline">{timeAgo(c.updatedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={ListChecks} title="No test cases yet" description="Create or import test cases to get started." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent test runs</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {runs.length ? (
              <ul className="divide-y">
                {runs.map((r) => (
                  <li key={r.id}>
                    <Link href={`${base}/runs/${r.id}`} className="block px-4 py-2.5 hover:bg-muted/60">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{r.title}</span>
                        <RunStatusBadge value={r.status} />
                      </div>
                      <RunProgressBar counts={r.counts} className="mt-2" />
                      <div className="mt-1">
                        <RunCountsInline counts={r.counts} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 text-sm text-muted-foreground">No runs yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
