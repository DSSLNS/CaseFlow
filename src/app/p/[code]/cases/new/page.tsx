import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { CaseForm } from "@/components/cases/case-form";
import { getProjectByCode, listUsers } from "@/server/context";
import { emptyCaseInput, loadFormProjects } from "@/server/form-data";

export const metadata: Metadata = { title: "New test case" };

export default async function NewCasePage({ params, searchParams }: PageProps<"/p/[code]/cases/new">) {
  const { code } = await params;
  const sp = await searchParams;
  const project = await getProjectByCode(code);
  const [projects, users] = await Promise.all([loadFormProjects(), listUsers()]);
  const suites = projects.find((p) => p.id === project.id)?.suites ?? [];
  const requested = typeof sp.suite === "string" ? sp.suite : "";
  const suiteId = suites.some((s) => s.id === requested) ? requested : "";
  const base = `/p/${project.code}`;

  return (
    <>
      <PageHeader
        title="New test case"
        crumbs={[
          { label: project.name, href: `${base}/dashboard` },
          { label: "Test Cases", href: `${base}/cases` },
          { label: "New" },
        ]}
      />
      <CaseForm
        caseId={null}
        defaults={emptyCaseInput(project.id, suiteId)}
        projects={projects}
        users={users}
        cancelHref={`${base}/cases`}
      />
    </>
  );
}
