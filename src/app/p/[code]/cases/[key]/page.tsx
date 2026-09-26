import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Archive, Paperclip } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/common/page-header";
import { PriorityBadge, ResultBadge, StatusBadge, TypeBadge } from "@/components/common/badges";
import { CaseActions } from "@/components/cases/case-actions";
import { db } from "@/lib/db";
import { formatEstimate } from "@/lib/estimate";
import { formatBytes, formatDateTime } from "@/lib/format";
import { flattenTree } from "@/lib/suite-tree";
import { getProjectByCode } from "@/server/context";
import { getCaseByKey } from "@/server/services/test-cases";

export async function generateMetadata({ params }: PageProps<"/p/[code]/cases/[key]">): Promise<Metadata> {
  const { key } = await params;
  return { title: key.toUpperCase() };
}

function Prop({ label, children, testId }: { label: string; children: React.ReactNode; testId?: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words" data-testid={testId}>
        {children}
      </dd>
    </>
  );
}

export default async function CaseViewPage({ params }: PageProps<"/p/[code]/cases/[key]">) {
  const { code, key } = await params;
  const project = await getProjectByCode(code);
  const tc = await getCaseByKey(project.id, project.code, key);
  if (!tc) notFound();
  const caseKey = `${project.code}-${tc.number}`;
  const base = `/p/${project.code}`;
  const [suites, history] = await Promise.all([
    db.suite.findMany({ where: { projectId: project.id }, select: { id: true, name: true, parentId: true } }),
    db.testRunCase.findMany({
      where: { testCaseId: tc.id },
      orderBy: { run: { createdAt: "desc" } },
      take: 10,
      include: { run: { select: { id: true, title: true, createdAt: true } }, executedBy: { select: { name: true } } },
    }),
  ]);
  const suitePath = flattenTree(suites).find((s) => s.id === tc.suiteId)?.path ?? tc.suite.name;

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <span className="font-mono text-base font-normal text-muted-foreground">{caseKey}</span>
            <span className="truncate" data-testid="case-title">
              {tc.title}
            </span>
          </span>
        }
        crumbs={[
          { label: project.name, href: `${base}/dashboard` },
          { label: "Test Cases", href: `${base}/cases` },
          { label: caseKey },
        ]}
        actions={<CaseActions projectId={project.id} code={project.code} caseId={tc.id} caseKey={caseKey} archived={tc.archived} />}
      />
      {tc.archived && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <Archive className="size-4" aria-hidden /> This test case is archived. It is hidden from the default list and cannot be added to
          new runs.
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap" data-testid="case-description">
                {tc.description || <span className="text-muted-foreground">No description.</span>}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Preconditions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap" data-testid="case-preconditions">
                {tc.preconditions || <span className="text-muted-foreground">None.</span>}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Steps ({tc.steps.length})</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {tc.steps.length ? (
                <table className="w-full text-sm" aria-label="Steps">
                  <thead className="border-y bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="w-10 px-4 py-2">#</th>
                      <th scope="col" className="px-2 py-2">Action</th>
                      <th scope="col" className="px-2 py-2">Expected result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tc.steps.map((s, i) => (
                      <tr key={s.id} className="border-b align-top last:border-0" data-testid="view-step">
                        <td className="px-4 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                        <td className="px-2 py-2 whitespace-pre-wrap">{s.action}</td>
                        <td className="px-2 py-2 whitespace-pre-wrap">{s.expectedResult || <span className="text-muted-foreground">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="px-4 text-sm text-muted-foreground">No steps defined.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent results</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {history.length ? (
                <ul className="divide-y text-sm">
                  {history.map((h) => (
                    <li key={h.id} className="flex items-center gap-3 px-4 py-2">
                      <ResultBadge value={h.status} />
                      <Link href={`${base}/runs/${h.run.id}?case=${h.id}`} className="min-w-0 flex-1 truncate hover:underline">
                        {h.run.title}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {h.executedBy?.name ?? ""} {h.executedAt ? formatDateTime(h.executedAt) : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 text-sm text-muted-foreground">This case has not been included in any test run.</p>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Properties</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2.5 text-sm">
                <Prop label="Project" testId="case-project">{project.name}</Prop>
                <Prop label="Suite" testId="case-suite">
                  <Link href={`${base}/cases?suite=${tc.suiteId}`} className="hover:underline">
                    {suitePath}
                  </Link>
                </Prop>
                <Prop label="Priority" testId="case-priority"><PriorityBadge value={tc.priority} /></Prop>
                <Prop label="Status" testId="case-status"><StatusBadge value={tc.status} /></Prop>
                <Prop label="Type" testId="case-type"><TypeBadge value={tc.type} /></Prop>
                <Prop label="Severity" testId="case-severity">{tc.severity ?? "—"}</Prop>
                <Prop label="Assignee" testId="case-assignee">{tc.assignee?.name ?? "Unassigned"}</Prop>
                <Prop label="Tags" testId="case-tags">
                  {tc.tags.length ? (
                    <span className="flex flex-wrap gap-1">
                      {tc.tags.map((t) => (
                        <span key={t.tagId} className="rounded bg-secondary px-1.5 py-0.5 text-xs">
                          {t.tag.name}
                        </span>
                      ))}
                    </span>
                  ) : (
                    "—"
                  )}
                </Prop>
                <Prop label="Estimate" testId="case-estimate">{formatEstimate(tc.estimateMinutes) || "—"}</Prop>
                <Prop label="Automation" testId="case-automation">{tc.automationStatus}</Prop>
                <Prop label="Automation ref" testId="case-automation-ref">
                  {tc.automationRef ? (
                    /^https?:\/\//.test(tc.automationRef) ? (
                      <a href={tc.automationRef} className="text-primary hover:underline" target="_blank" rel="noreferrer">
                        {tc.automationRef}
                      </a>
                    ) : (
                      <code className="text-xs">{tc.automationRef}</code>
                    )
                  ) : (
                    "—"
                  )}
                </Prop>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Attachments</CardTitle>
            </CardHeader>
            <CardContent>
              {tc.attachments.length ? (
                <ul className="flex flex-col gap-1 text-sm" data-testid="case-attachments">
                  {tc.attachments.map((a) => (
                    <li key={a.id} className="flex items-center gap-2">
                      <Paperclip className="size-4 text-muted-foreground" aria-hidden />
                      <a href={`/api/attachments/${a.id}`} className="min-w-0 flex-1 truncate hover:underline">
                        {a.filename}
                      </a>
                      <span className="text-xs text-muted-foreground">{formatBytes(a.size)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No attachments.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
              <span className="text-muted-foreground">Created</span>
              <span data-testid="case-created">
                {tc.createdBy?.name ?? "—"} · {formatDateTime(tc.createdAt)}
              </span>
              <span className="text-muted-foreground">Updated</span>
              <span data-testid="case-updated">
                {tc.updatedBy?.name ?? "—"} · {formatDateTime(tc.updatedAt)}
              </span>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
