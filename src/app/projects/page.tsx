import type { Metadata } from "next";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { FolderOpen, Plus, Workflow } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAuth, listUserProjects } from "@/server/context";
import { ProjectCreateDialog } from "@/components/common/project-create-dialog";
import { LogoutButton } from "@/components/auth/logout-button";

export const metadata: Metadata = { title: "Choose a project" };

export default async function ProjectsPage() {
  const user = await requireAuth();
  const projects = await listUserProjects();

  return (
    <main className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Workflow className="size-4" aria-hidden />
          </div>
          <span className="text-sm font-semibold">CaseFlow</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{user.name}</span>
          <LogoutButton />
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Choose a project</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Select a project to continue, or create a new one.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Create new project card */}
          <ProjectCreateDialog>
            <button
              type="button"
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-card p-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Plus className="size-5" aria-hidden />
              </div>
              <div>
                <div className="text-sm font-semibold">Create a new project</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Set up test suites, cases, and runs
                </div>
              </div>
            </button>
          </ProjectCreateDialog>

          {/* Existing project cards */}
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/p/${p.code}/dashboard`}
              className="group flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-xs transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-bold text-accent-foreground">
                  {p.code.slice(0, 3)}
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {p.code}
                </Badge>
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold group-hover:text-primary">{p.name}</div>
                {p.description && (
                  <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {p.description}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FolderOpen className="size-3.5" aria-hidden />
                Updated {formatDistanceToNow(new Date(p.updatedAt), { addSuffix: true })}
              </div>
            </Link>
          ))}
        </div>

        {projects.length === 0 && (
          <div className="mt-6 rounded-xl border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            You don&apos;t have access to any projects yet. Create one to get started, or ask an
            admin to add you to an existing project.
          </div>
        )}
      </div>
    </main>
  );
}
