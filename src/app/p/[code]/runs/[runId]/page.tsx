import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { RunExecution } from "@/components/runs/run-execution";
import { getProjectByCode } from "@/server/context";
import { getRun } from "@/server/services/runs";

export const metadata: Metadata = { title: "Test run" };

function parseSteps(json: string): { action: string; expectedResult: string }[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export default async function RunPage({ params }: PageProps<"/p/[code]/runs/[runId]">) {
  const { code, runId } = await params;
  const project = await getProjectByCode(code);
  const run = await getRun(project.id, runId);
  if (!run) notFound();
  const base = `/p/${project.code}`;
  return (
    <>
      <PageHeader
        title={run.title}
        crumbs={[
          { label: project.name, href: `${base}/dashboard` },
          { label: "Test Runs", href: `${base}/runs` },
          { label: run.title },
        ]}
      />
      <RunExecution
        projectId={project.id}
        code={project.code}
        run={{
          id: run.id,
          title: run.title,
          description: run.description,
          status: run.status,
          owner: run.owner?.name ?? null,
          environment: run.environment,
          buildVersion: run.buildVersion,
          releaseRef: run.releaseRef,
          executionDate: run.executionDate?.toISOString() ?? null,
          sourceSuites: run.sourceSuites,
          createdAt: run.createdAt.toISOString(),
          completedAt: run.completedAt?.toISOString() ?? null,
          cases: run.cases.map((c) => ({
            id: c.id,
            testCaseId: c.testCaseId,
            caseKey: c.caseKey,
            title: c.title,
            suiteName: c.suiteName,
            priority: c.priority,
            preconditions: c.preconditions,
            steps: parseSteps(c.stepsSnapshot),
            status: c.status,
            comment: c.comment,
            bugRef: c.bugRef,
            executedBy: c.executedBy?.name ?? null,
            executedAt: c.executedAt?.toISOString() ?? null,
            history: c.executions.map((e) => ({
              id: e.id,
              status: e.status,
              comment: e.comment,
              bugRef: e.bugRef,
              evidence: e.evidence.map((v) => ({ id: v.id, kind: v.kind, label: v.label, url: v.url, provider: v.provider })),
              by: e.executedBy?.name ?? null,
              at: e.createdAt.toISOString(),
            })),
          })),
        }}
      />
    </>
  );
}
