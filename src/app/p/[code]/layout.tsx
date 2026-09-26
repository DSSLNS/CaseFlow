import { AppShell } from "@/components/layout/sidebar";
import { requireProjectAccess, listProjects, listUsers } from "@/server/context";

export default async function ProjectLayout({ children, params }: LayoutProps<"/p/[code]">) {
  const { code } = await params;
  const { project, user } = await requireProjectAccess(code);
  const [projects, users] = await Promise.all([listProjects(), listUsers()]);
  return (
    <AppShell
      project={{ id: project.id, name: project.name, code: project.code }}
      projects={projects}
      users={users}
      currentUser={{ id: user.id, name: user.name, email: user.email }}
    >
      {children}
    </AppShell>
  );
}
