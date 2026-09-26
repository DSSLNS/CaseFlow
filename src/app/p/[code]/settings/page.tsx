import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { SettingsForm } from "@/components/common/settings-form";
import { parseSeverities } from "@/lib/constants";
import { getProjectByCode } from "@/server/context";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ params }: PageProps<"/p/[code]/settings">) {
  const { code } = await params;
  const project = await getProjectByCode(code);
  return (
    <>
      <PageHeader
        title="Settings"
        crumbs={[{ label: project.name, href: `/p/${project.code}/dashboard` }, { label: "Settings" }]}
      />
      <SettingsForm
        project={{
          id: project.id,
          name: project.name,
          code: project.code,
          description: project.description,
          severities: parseSeverities(project.severities),
        }}
      />
    </>
  );
}
