import Link from "next/link";
import type { Metadata } from "next";
import { FileUp, ListChecks, Plus, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { CaseFilters } from "@/components/cases/case-filters";
import { CasesTable } from "@/components/cases/cases-table";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "@/lib/constants";
import { flattenTree } from "@/lib/suite-tree";
import { getProjectByCode, listUsers } from "@/server/context";
import { listSuites } from "@/server/services/suites";
import { listTestCases } from "@/server/services/test-cases";

export const metadata: Metadata = { title: "Test Cases" };

export default async function CasesPage({ params, searchParams }: PageProps<"/p/[code]/cases">) {
  const { code } = await params;
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const project = await getProjectByCode(code);
  const size = Number(str("size"));
  const pageSize = (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE;

  const [suites, users, result] = await Promise.all([
    listSuites(project.id),
    listUsers(),
    listTestCases(project, {
      q: str("q"),
      suite: str("suite"),
      priority: str("priority"),
      status: str("status"),
      type: str("type"),
      assignee: str("assignee"),
      archived: str("archived"),
      sort: str("sort"),
      dir: str("dir"),
      page: Number(str("page")) || 1,
      pageSize,
    }),
  ]);
  const suiteOptions = flattenTree(suites);
  const filtered = ["q", "suite", "priority", "status", "type", "assignee"].some((k) => str(k));
  const base = `/p/${project.code}`;

  return (
    <>
      <PageHeader
        title="Test Cases"
        crumbs={[{ label: project.name, href: `${base}/dashboard` }, { label: "Test Cases" }]}
        description={`${result.total} ${str("archived") === "1" ? "archived " : ""}test case${result.total === 1 ? "" : "s"}${filtered ? " match the current filters" : ""}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`${base}/import`}>
                <FileUp aria-hidden /> Import
              </Link>
            </Button>
            <Button asChild>
              <Link href={`${base}/cases/new${str("suite") ? `?suite=${str("suite")}` : ""}`}>
                <Plus aria-hidden /> Create test case
              </Link>
            </Button>
          </>
        }
      />
      <Card className="gap-0 overflow-hidden py-0">
        <div className="border-b p-3">
          <CaseFilters suites={suiteOptions} users={users} />
        </div>
        {result.items.length === 0 ? (
          filtered || str("archived") === "1" ? (
            <EmptyState
              icon={SearchX}
              title={str("archived") === "1" && !filtered ? "No archived test cases" : "No test cases match your filters"}
              description="Try a different search term or clear the filters."
            />
          ) : (
            <EmptyState
              icon={ListChecks}
              title="No test cases yet"
              description="Create your first test case or import existing ones from CSV or Excel."
              action={
                <div className="flex gap-2">
                  <Button variant="outline" asChild>
                    <Link href={`${base}/import`}>Import</Link>
                  </Button>
                  <Button asChild>
                    <Link href={`${base}/cases/new`}>Create test case</Link>
                  </Button>
                </div>
              }
            />
          )
        ) : (
          <CasesTable
            projectId={project.id}
            code={project.code}
            items={result.items.map((i) => ({ ...i, updatedAt: i.updatedAt.toISOString() }))}
            suites={suiteOptions}
            total={result.total}
            page={result.page}
            pageCount={result.pageCount}
            pageSize={result.pageSize}
            sort={result.sort ?? "updated"}
            dir={result.dir}
          />
        )}
      </Card>
    </>
  );
}
