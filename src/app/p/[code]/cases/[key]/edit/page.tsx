import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { CaseForm } from "@/components/cases/case-form";
import { getProjectByCode, listUsers } from "@/server/context";
import { caseToInput, loadFormProjects } from "@/server/form-data";
import { getCaseByKey } from "@/server/services/test-cases";

export async function generateMetadata({ params }: PageProps<"/p/[code]/cases/[key]/edit">): Promise<Metadata> {
  const { key } = await params;
  return { title: `Edit ${key.toUpperCase()}` };
}

export default async function EditCasePage({ params }: PageProps<"/p/[code]/cases/[key]/edit">) {
  const { code, key } = await params;
  const project = await getProjectByCode(code);
  const tc = await getCaseByKey(project.id, project.code, key);
  if (!tc) notFound();
  const [projects, users] = await Promise.all([loadFormProjects(), listUsers()]);
  const caseKey = `${project.code}-${tc.number}`;
  const base = `/p/${project.code}`;

  return (
    <>
      <PageHeader
        title={`Edit ${caseKey}`}
        crumbs={[
          { label: project.name, href: `${base}/dashboard` },
          { label: "Test Cases", href: `${base}/cases` },
          { label: caseKey, href: `${base}/cases/${caseKey}` },
          { label: "Edit" },
        ]}
      />
      <CaseForm
        caseId={tc.id}
        defaults={caseToInput(tc)}
        projects={projects}
        users={users}
        attachments={tc.attachments.map((a) => ({ id: a.id, filename: a.filename, size: a.size, uploadedBy: a.uploadedBy?.name ?? null }))}
        meta={{
          key: caseKey,
          createdBy: tc.createdBy?.name ?? null,
          createdAt: tc.createdAt.toISOString(),
          updatedBy: tc.updatedBy?.name ?? null,
          updatedAt: tc.updatedAt.toISOString(),
        }}
        cancelHref={`${base}/cases/${caseKey}`}
      />
    </>
  );
}
