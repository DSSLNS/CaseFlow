import type { Metadata } from "next";
import { format } from "date-fns";
import { PageHeader } from "@/components/common/page-header";
import { RunForm } from "@/components/runs/run-form";
import { db } from "@/lib/db";
import { flattenTree } from "@/lib/suite-tree";
import { getCurrentUser, getProjectByCode, listUsers } from "@/server/context";

export const metadata: Metadata = { title: "Start test run" };

export default async function NewRunPage({ params, searchParams }: PageProps<"/p/[code]/runs/new">) {
  const { code } = await params;
  const sp = await searchParams;
  const project = await getProjectByCode(code);
  const [cases, suites, users, me] = await Promise.all([
    db.testCase.findMany({
      where: { projectId: project.id, archived: false },
      orderBy: { number: "asc" },
      select: { id: true, number: true, title: true, suiteId: true, priority: true },
    }),
    db.suite.findMany({ where: { projectId: project.id }, select: { id: true, name: true, parentId: true, position: true } }),
    listUsers(),
    getCurrentUser(),
  ]);
  const preselected = typeof sp.cases === "string" ? sp.cases.split(",").filter(Boolean) : [];
  const base = `/p/${project.code}`;
  return (
    <>
      <PageHeader
        title="Start test run"
        crumbs={[
          { label: project.name, href: `${base}/dashboard` },
          { label: "Test Runs", href: `${base}/runs` },
          { label: "New" },
        ]}
      />
      <RunForm
        projectId={project.id}
        code={project.code}
        cases={cases.map((c) => ({ id: c.id, key: `${project.code}-${c.number}`, title: c.title, suiteId: c.suiteId, priority: c.priority }))}
        suites={flattenTree(suites)}
        users={users}
        currentUserId={me?.id ?? ""}
        preselected={preselected}
        defaultTitle={`Test run ${format(new Date(), "MMM d, yyyy")}`}
        today={format(new Date(), "yyyy-MM-dd")}
      />
    </>
  );
}
