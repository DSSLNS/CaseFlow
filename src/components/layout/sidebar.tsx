"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  BarChart3,
  Check,
  ChevronsUpDown,
  FileUp,
  FolderTree,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  PlayCircle,
  Plus,
  Settings,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { logout } from "@/server/actions/auth";
import { cn } from "@/lib/utils";

type Project = { id: string; name: string; code: string };
type User = { id: string; name: string; email: string };

export type ShellProps = {
  project: Project;
  projects: Project[];
  users: User[];
  currentUser: User | null;
};

const NAV = [
  { href: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "cases", label: "Test Cases", icon: ListChecks },
  { href: "suites", label: "Test Suites", icon: FolderTree },
  { href: "runs", label: "Test Runs", icon: PlayCircle },
  { href: "import", label: "Import Test Cases", icon: FileUp },
  { href: "reports", label: "Reports", icon: BarChart3 },
  { href: "settings", label: "Settings", icon: Settings },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function SidebarContent({ project, projects, currentUser, onNavigate }: ShellProps & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Workflow className="size-4" aria-hidden />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">CaseFlow</div>
          <div className="text-[11px] text-muted-foreground">From writing to execution</div>
        </div>
      </div>

      <div className="px-3 pb-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Current project: ${project.name}. Switch project`}
              className="flex w-full items-center gap-2 rounded-lg border bg-background px-2.5 py-2 text-left text-sm hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded bg-accent text-[10px] font-bold text-accent-foreground">
                {project.code.slice(0, 3)}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{project.name}</span>
              <ChevronsUpDown className="size-4 text-muted-foreground" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel>Projects</DropdownMenuLabel>
            {projects.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onSelect={() => {
                  onNavigate?.();
                  router.push(`/p/${p.code}/dashboard`);
                }}
              >
                <span className="w-9 font-mono text-xs text-muted-foreground">{p.code}</span>
                <span className="flex-1 truncate">{p.name}</span>
                {p.id === project.id && <Check className="size-4" aria-label="Current project" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/projects" onClick={onNavigate}>
                <Plus aria-hidden /> All projects
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3">
        <ul className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            const href = `/p/${project.code}/${item.href}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent",
                  )}
                >
                  <item.icon className="size-4" aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="User menu"
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {currentUser ? initials(currentUser.name) : "?"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{currentUser?.name ?? "No user"}</span>
                <span className="block truncate text-xs text-muted-foreground">{currentUser?.email}</span>
              </span>
              <ChevronsUpDown className="size-4 text-muted-foreground" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-64">
            <DropdownMenuLabel className="font-normal">
              <div className="truncate text-xs font-medium">{currentUser?.name}</div>
              <div className="truncate text-xs text-muted-foreground">{currentUser?.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() =>
                startTransition(async () => {
                  await logout();
                })
              }
              disabled={pending}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="size-4" aria-hidden />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function AppShell({ children, ...props }: ShellProps & { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  // Remember the last opened project for the "/" redirect.
  useEffect(() => {
    document.cookie = `tcm_project=${props.project.code}; path=/; max-age=31536000; samesite=lax`;
  }, [props.project.code]);

  return (
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="sr-only z-50 rounded bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r bg-sidebar lg:block">
        <SidebarContent {...props} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarContent {...props} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <Workflow className="size-4 text-primary" aria-hidden />
          <span className="text-sm font-semibold">CaseFlow</span>
          <span className="truncate text-sm text-muted-foreground">/ {props.project.name}</span>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
