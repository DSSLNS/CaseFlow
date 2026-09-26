import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/common/page-header";
import { Stat } from "@/components/import/preview-step";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getProjectByCode } from "@/server/context";

export const metadata: Metadata = { title: "Import details" };

const OUTCOME_STYLE: Record<string, string> = {
  created: "text-emerald-700",
  updated: "text-blue-700",
  skipped: "text-muted-foreground",
  failed: "text-destructive",
};

export default async function ImportBatchPage({ params }: PageProps<"/p/[code]/import/[batchId]">) {
  const { code, batchId } = await params;
  const project = await getProjectByCode(code);
  const batch = await db.importBatch.findFirst({
    where: { id: batchId, projectId: project.id },
    include: { rows: { orderBy: { rowNumber: "asc" } }, createdBy: { select: { name: true } } },
  });
  if (!batch) notFound();
  const base = `/p/${project.code}`;
  return (
    <>
      <PageHeader
        title={batch.filename}
        description={`Imported ${formatDateTime(batch.createdAt)} by ${batch.createdBy?.name ?? "unknown"} · ${batch.status}`}
        crumbs={[
          { label: project.name, href: `${base}/dashboard` },
          { label: "Import", href: `${base}/import` },
          { label: batch.filename },
        ]}
      />
      {batch.errorMessage && (
        <p role="alert" className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {batch.errorMessage}
        </p>
      )}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Rows in file" value={batch.totalRows} />
        <Stat label="Created" value={batch.createdCount} tone="good" testId="batch-created" />
        <Stat label="Updated" value={batch.updatedCount} testId="batch-updated" />
        <Stat label="Skipped" value={batch.skippedCount} testId="batch-skipped" />
        <Stat label="Failed" value={batch.failedCount} tone={batch.failedCount ? "bad" : undefined} testId="batch-failed" />
      </div>
      <Card className="gap-0 overflow-hidden py-0">
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm" aria-label="Row results">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="w-16 px-4 py-2">Row</th>
                  <th scope="col" className="w-24 px-2 py-2">Outcome</th>
                  <th scope="col" className="w-24 px-2 py-2">Case</th>
                  <th scope="col" className="px-2 py-2">Title</th>
                  <th scope="col" className="px-4 py-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {batch.rows.map((r) => (
                  <tr key={r.id} className="border-t align-top" data-testid="batch-row">
                    <td className="px-4 py-2 text-muted-foreground tabular-nums">{r.rowNumber}</td>
                    <td className={cn("px-2 py-2 font-medium capitalize", OUTCOME_STYLE[r.outcome])}>{r.outcome}</td>
                    <td className="px-2 py-2 font-mono text-xs">
                      {r.caseKey ? (
                        <Link href={`${base}/cases/${r.caseKey}`} className="hover:underline">
                          {r.caseKey}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-2">{r.title || <em className="text-muted-foreground">(no title)</em>}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{r.message || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
