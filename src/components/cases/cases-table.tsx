"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  FolderInput,
  MoreHorizontal,
  Pencil,
  PlayCircle,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { PriorityBadge, StatusBadge, TypeBadge } from "@/components/common/badges";
import { SuiteSelect } from "@/components/common/suite-select";
import { useSearchUpdater } from "./case-filters";
import {
  archiveTestCases,
  bulkUpdateTestCases,
  deleteTestCases,
  duplicateTestCase,
  moveTestCases,
} from "@/server/actions/cases";
import { CASE_STATUSES, PAGE_SIZES, PRIORITIES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { SuiteOption } from "@/lib/suite-tree";
import { toastResult } from "@/lib/toast-result";
import { cn } from "@/lib/utils";

export type CaseRow = {
  id: string;
  number: number;
  title: string;
  priority: string;
  status: string;
  type: string;
  archived: boolean;
  updatedAt: string;
  suite: { id: string; name: string };
  assignee: { id: string; name: string } | null;
};

type Props = {
  projectId: string;
  code: string;
  items: CaseRow[];
  suites: SuiteOption[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  sort: string;
  dir: string;
};

function SortHeader({ label, col, sort, dir }: { label: string; col: string; sort: string; dir: string }) {
  const { update } = useSearchUpdater();
  const active = sort === col;
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => update({ sort: col, dir: active && dir === "asc" ? "desc" : "asc" })}
      className="inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      aria-label={`Sort by ${label}${active ? (dir === "asc" ? ", currently ascending" : ", currently descending") : ""}`}
    >
      {label}
      <Icon className={cn("size-3", !active && "opacity-40")} aria-hidden />
    </button>
  );
}

export function CasesTable(props: Props) {
  const { projectId, code, items, suites, total, page, pageCount, pageSize, sort, dir } = props;
  const router = useRouter();
  const { update } = useSearchUpdater();
  const [rawSelected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState("");

  // Only rows visible after filtering/paging count as selected.
  const selected = useMemo(() => new Set([...rawSelected].filter((id) => items.some((i) => i.id === id))), [rawSelected, items]);

  const ids = [...selected];
  const allChecked = items.length > 0 && items.every((i) => selected.has(i.id));
  const someChecked = items.some((i) => selected.has(i.id));
  const showingArchived = items.length > 0 && items[0].archived;

  const run = (fn: () => Promise<{ ok: boolean }>) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setSelected(new Set());
        router.refresh();
      }
    });

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col">
      {selected.size > 0 && (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="flex flex-wrap items-center gap-2 border-b bg-accent/60 px-3 py-2 text-sm"
        >
          <span className="font-medium" data-testid="selected-count">
            {selected.size} selected
          </span>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setMoveOpen(true)}>
            <FolderInput aria-hidden /> Move to suite
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={pending}>
                Set field
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Priority</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {PRIORITIES.map((p) => (
                    <DropdownMenuItem
                      key={p}
                      onSelect={() => run(async () => toastResult(await bulkUpdateTestCases(projectId, ids, { field: "priority", value: p })))}
                    >
                      {p}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Status</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {CASE_STATUSES.map((s) => (
                    <DropdownMenuItem
                      key={s}
                      onSelect={() => run(async () => toastResult(await bulkUpdateTestCases(projectId, ids, { field: "status", value: s })))}
                    >
                      {s}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
          {!showingArchived && (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/p/${code}/runs/new?cases=${ids.join(",")}`}>
                <PlayCircle aria-hidden /> Start run
              </Link>
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(async () => toastResult(await archiveTestCases(projectId, ids, !showingArchived)))}
          >
            {showingArchived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
            {showingArchived ? "Restore" : "Archive"}
          </Button>
          <Button size="sm" variant="destructive" disabled={pending} onClick={() => setConfirmDelete(ids)}>
            <Trash2 aria-hidden /> Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
        </div>
      )}

      <div className="relative max-h-[calc(100vh-260px)] min-h-40 overflow-auto">
        <table className="w-full min-w-[860px] text-sm" aria-label="Test cases" aria-busy={pending}>
          <thead className="sticky top-0 z-10 bg-muted/95 text-left text-xs font-medium text-muted-foreground backdrop-blur">
            <tr className="border-b">
              <th scope="col" className="w-10 px-3 py-2">
                <Checkbox
                  aria-label="Select all on this page"
                  checked={allChecked ? true : someChecked ? "indeterminate" : false}
                  onCheckedChange={(v) => setSelected(v ? new Set(items.map((i) => i.id)) : new Set())}
                />
              </th>
              <th scope="col" className="w-24 px-2 py-2">
                <SortHeader label="ID" col="id" sort={sort} dir={dir} />
              </th>
              <th scope="col" className="px-2 py-2">
                <SortHeader label="Title" col="title" sort={sort} dir={dir} />
              </th>
              <th scope="col" className="px-2 py-2">Suite</th>
              <th scope="col" className="px-2 py-2">
                <SortHeader label="Priority" col="priority" sort={sort} dir={dir} />
              </th>
              <th scope="col" className="px-2 py-2">Status</th>
              <th scope="col" className="px-2 py-2">Type</th>
              <th scope="col" className="px-2 py-2">Assignee</th>
              <th scope="col" className="px-2 py-2">
                <SortHeader label="Updated" col="updated" sort={sort} dir={dir} />
              </th>
              <th scope="col" className="w-12 px-2 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => {
              const key = `${code}-${c.number}`;
              const href = `/p/${code}/cases/${key}`;
              return (
                <tr key={c.id} data-testid="case-row" className={cn("border-b hover:bg-muted/40", selected.has(c.id) && "bg-accent/40")}>
                  <td className="px-3 py-2">
                    <Checkbox
                      aria-label={`Select ${key}`}
                      checked={selected.has(c.id)}
                      onCheckedChange={(v) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (v) next.add(c.id);
                          else next.delete(c.id);
                          return next;
                        })
                      }
                    />
                  </td>
                  <td className="px-2 py-2 font-mono text-xs whitespace-nowrap text-muted-foreground">{key}</td>
                  <td className="max-w-[360px] px-2 py-2">
                    <Link href={href} className="line-clamp-2 font-medium hover:text-primary hover:underline">
                      {c.title}
                    </Link>
                  </td>
                  <td className="max-w-[180px] truncate px-2 py-2 text-muted-foreground">{c.suite.name}</td>
                  <td className="px-2 py-2">
                    <PriorityBadge value={c.priority} />
                  </td>
                  <td className="px-2 py-2">
                    <StatusBadge value={c.status} />
                  </td>
                  <td className="px-2 py-2">
                    <TypeBadge value={c.type} />
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-muted-foreground">{c.assignee?.name ?? "—"}</td>
                  <td className="px-2 py-2 whitespace-nowrap text-muted-foreground">{formatDate(c.updatedAt)}</td>
                  <td className="px-2 py-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${key}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel className="font-mono text-xs">{key}</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                          <Link href={href}>
                            <Eye aria-hidden /> View
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`${href}/edit`}>
                            <Pencil aria-hidden /> Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => run(async () => toastResult(await duplicateTestCase(projectId, c.id)))}
                        >
                          <Copy aria-hidden /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => run(async () => toastResult(await archiveTestCases(projectId, [c.id], !c.archived)))}
                        >
                          {c.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
                          {c.archived ? "Restore" : "Archive"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete([c.id])}>
                          <Trash2 aria-hidden /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-3 py-2 text-sm text-muted-foreground">
        <span data-testid="pagination-summary">
          {from}–{to} of {total}
        </span>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline">Rows per page</span>
          <Select value={String(pageSize)} onValueChange={(v) => update({ size: v })}>
            <SelectTrigger size="sm" aria-label="Rows per page" className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => update({ page: String(page - 1) }, false)}
          >
            <ChevronLeft />
          </Button>
          <span className="tabular-nums">
            Page {page} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next page"
            disabled={page >= pageCount}
            onClick={() => update({ page: String(page + 1) }, false)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title={confirmDelete?.length === 1 ? "Delete this test case?" : `Delete ${confirmDelete?.length} test cases?`}
        description="This permanently deletes the test case(s), their steps and attachments. Past test runs keep their recorded results. This cannot be undone."
        onConfirm={async () => {
          const res = toastResult(await deleteTestCases(projectId, confirmDelete ?? []));
          if (res.ok) {
            setSelected(new Set());
            router.refresh();
          }
          return res.ok;
        }}
      />

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move {selected.size} test case(s)</DialogTitle>
            <DialogDescription>Choose the destination suite.</DialogDescription>
          </DialogHeader>
          <SuiteSelect id="move-target" options={suites} value={moveTarget} onChange={setMoveTarget} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!moveTarget || pending}
              onClick={() =>
                run(async () => {
                  const res = toastResult(await moveTestCases(projectId, ids, moveTarget));
                  if (res.ok) setMoveOpen(false);
                  return res;
                })
              }
            >
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
