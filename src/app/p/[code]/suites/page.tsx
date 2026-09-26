import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/common/page-header";
import { SuiteTree } from "@/components/suites/suite-tree";
import { getProjectByCode } from "@/server/context";
import { listSuitesWithCounts } from "@/server/services/suites";

export const metadata: Metadata = { title: "Test Suites" };

export default async function SuitesPage({ params }: PageProps<"/p/[code]/suites">) {
  const { code } = await params;
  const project = await getProjectByCode(code);
  const suites = await listSuitesWithCounts(project.id);
  return (
    <>
      <PageHeader
        title="Test Suites"
        description="Organize test cases into suites and sub-suites. Counts include sub-suites; archived cases are excluded."
        crumbs={[{ label: project.name, href: `/p/${project.code}/dashboard` }, { label: "Test Suites" }]}
      />
      <Card className="max-w-3xl gap-0 py-0">
        <SuiteTree projectId={project.id} code={project.code} suites={suites} />
      </Card>
    </>
  );
}
