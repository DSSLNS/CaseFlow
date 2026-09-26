import Link from "next/link";
import type { Metadata } from "next";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/common/page-header";
import { ImportWizard } from "@/components/import/import-wizard";
import { db } from "@/lib/db";
import { formatBytes, formatDateTime } from "@/lib/format";
import { flattenTree } from "@/lib/suite-tree";
import { getProjectByCode } from "@/server/context";
import { listSuites } from "@/server/services/suites";

export const metadata: Metadata = { title: "Import Test Cases" };

export default async function ImportPage({ params }: PageProps<"/p/[code]/import">) {
  const { code } = await params;
  const project = await getProjectByCode(code);
  const [suites, history] = await Promise.all([
    listSuites(project.id),
    db.importBatch.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { createdBy: { select: { name: true } } },
    }),
  ]);
  const base = `/p/${project.code}`;
  return (
    <>
      <PageHeader
        title="Import Test Cases"
        description="Bring existing test cases in from CSV or Excel. Map your columns, review problems, then confirm."
        crumbs={[{ label: project.name, href: `${base}/dashboard` }, { label: "Import" }]}
        actions={
          <Button variant="outline" asChild>
            <a href="/templates/caseflow-import-template.csv" download>
              <Download aria-hidden /> CSV template
            </a>
          </Button>
        }
      />
      <ImportWizard projectId={project.id} code={project.code} suites={flattenTree(suites)} />

      <Card className="mt-6 gap-0 py-0">
        <CardHeader className="py-4">
          <CardTitle className="text-sm">Import history</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {history.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm" aria-label="Import history">
                <thead className="border-y bg-muted/60 text-left text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2">File</th>
                    <th scope="col" className="px-2 py-2">When</th>
                    <th scope="col" className="px-2 py-2">By</th>
                    <th scope="col" className="px-2 py-2">Outcome</th>
                    <th scope="col" className="px-2 py-2 text-right">Created</th>
                    <th scope="col" className="px-2 py-2 text-right">Updated</th>
                    <th scope="col" className="px-2 py-2 text-right">Skipped</th>
                    <th scope="col" className="px-4 py-2 text-right">Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((b) => (
                    <tr key={b.id} className="border-b last:border-0" data-testid="import-history-row">
                      <td className="px-4 py-2">
                        <Link href={`${base}/import/${b.id}`} className="font-medium hover:underline">
                          {b.filename}
                        </Link>
                        <div className="text-xs text-muted-foreground">{formatBytes(b.fileSize)} · {b.totalRows} rows</div>
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-muted-foreground">{formatDateTime(b.createdAt)}</td>
                      <td className="px-2 py-2 text-muted-foreground">{b.createdBy?.name ?? "—"}</td>
                      <td className="px-2 py-2">
                        <span className={b.status === "Completed" ? "text-emerald-700" : "text-destructive"}>{b.status}</span>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{b.createdCount}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{b.updatedCount}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{b.skippedCount}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{b.failedCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-4 pb-4 text-sm text-muted-foreground">No imports yet.</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
