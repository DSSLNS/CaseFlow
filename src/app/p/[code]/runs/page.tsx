import Link from "next/link";
import type { Metadata } from "next";
import { PlayCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { RunStatusBadge } from "@/components/common/badges";
import { RunCountsInline, RunProgressBar } from "@/components/runs/progress-bar";
import { formatDateTime } from "@/lib/format";
import { getProjectByCode } from "@/server/context";
import { listRuns } from "@/server/services/runs";

export const metadata: Metadata = { title: "Test Runs" };

export default async function RunsPage({ params }: PageProps<"/p/[code]/runs">) {
  const { code } = await params;
  const project = await getProjectByCode(code);
  const runs = await listRuns(project.id);
  const base = `/p/${project.code}`;
  return (
    <>
      <PageHeader
        title="Test Runs"
        description="Each run keeps its own results; starting a new run never overwrites earlier ones."
        crumbs={[{ label: project.name, href: `${base}/dashboard` }, { label: "Test Runs" }]}
        actions={
          <Button asChild>
            <Link href={`${base}/runs/new`}>
              <Plus aria-hidden /> Start test run
            </Link>
          </Button>
        }
      />
      <Card className="gap-0 overflow-hidden py-0">
        {runs.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm" aria-label="Test runs">
              <thead className="bg-muted/80 text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th scope="col" className="px-4 py-2">Run</th>
                  <th scope="col" className="px-2 py-2">Status</th>
                  <th scope="col" className="w-64 px-2 py-2">Progress</th>
                  <th scope="col" className="px-2 py-2">Environment / build</th>
                  <th scope="col" className="px-2 py-2">Tester</th>
                  <th scope="col" className="px-2 py-2">Started</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40" data-testid="run-row">
                    <td className="px-4 py-2.5">
                      <Link href={`${base}/runs/${r.id}`} className="font-medium hover:text-primary hover:underline">
                        {r.title}
                      </Link>
                      <div className="mt-1">
                        <RunCountsInline counts={r.counts} />
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <RunStatusBadge value={r.status} />
                    </td>
                    <td className="px-2 py-2.5">
                      <RunProgressBar counts={r.counts} />
                    </td>
                    <td className="px-2 py-2.5 text-muted-foreground">
                      <div>{r.environment || "—"}</div>
                      <div className="text-xs">{[r.buildVersion, r.releaseRef].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="px-2 py-2.5 text-muted-foreground">{r.owner?.name ?? "—"}</td>
                    <td className="px-2 py-2.5 whitespace-nowrap text-muted-foreground">{formatDateTime(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={PlayCircle}
            title="No test runs yet"
            description="Start a run from all cases, selected suites, or specific cases."
            action={
              <Button asChild>
                <Link href={`${base}/runs/new`}>Start test run</Link>
              </Button>
            }
          />
        )}
      </Card>
    </>
  );
}
