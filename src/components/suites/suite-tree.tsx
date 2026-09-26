"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Folder, FolderOpen, FolderPlus, FolderTree, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { SuiteSelect } from "@/components/common/suite-select";
import { SuiteDialog, type EditingSuite } from "./suite-dialog";
import { deleteSuite } from "@/server/actions/suites";
import { buildTree, descendantIds, flattenTree, type SuiteNode } from "@/lib/suite-tree";

export type SuiteWithCounts = {
  id: string;
  name: string;
  parentId: string | null;
  position: number;
  description: string;
  caseCount: number;
  totalCount: number;
};

export function SuiteTree({ projectId, code, suites }: { projectId: string; code: string; suites: SuiteWithCounts[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tree = useMemo(() => buildTree(suites), [suites]);
  const options = useMemo(() => flattenTree(suites), [suites]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<EditingSuite | null>(() =>
    searchParams.get("new") === "1" ? { id: null, name: "", description: "", parentId: "" } : null,
  );
  const [deleting, setDeleting] = useState<SuiteWithCounts | null>(null);
  const [deleteMode, setDeleteMode] = useState<"move" | "delete" | "">("");
  const [moveTarget, setMoveTarget] = useState("");

  useEffect(() => {
    // The dashboard's "Create suite" link opens the dialog via ?new=1; clean the URL.
    if (searchParams.get("new") === "1") {
      router.replace(`/p/${code}/suites`, { scroll: false });
    }
  }, [searchParams, code, router]);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderNode = (node: SuiteNode<SuiteWithCounts>, depth: number): React.ReactNode => {
    const open = !collapsed.has(node.id);
    const hasChildren = node.children.length > 0;
    return (
      <li key={node.id} role="treeitem" aria-expanded={hasChildren ? open : undefined} aria-selected={false} aria-level={depth + 1}>
        <div
          className="group flex items-center gap-1.5 rounded-md py-1.5 pr-2 hover:bg-muted/60"
          style={{ paddingLeft: depth * 20 + 6 }}
          data-testid="suite-node"
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggle(node.id)}
              className="rounded p-0.5 text-muted-foreground hover:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label={`${open ? "Collapse" : "Expand"} ${node.name}`}
            >
              {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          ) : (
            <span className="w-5" />
          )}
          {open && hasChildren ? (
            <FolderOpen className="size-4 text-primary/80" aria-hidden />
          ) : (
            <Folder className="size-4 text-primary/80" aria-hidden />
          )}
          <Link href={`/p/${code}/cases?suite=${node.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
            {node.name}
          </Link>
          <span
            className="rounded bg-muted px-1.5 text-xs text-muted-foreground tabular-nums"
            title={`${node.caseCount} directly, ${node.totalCount} including sub-suites`}
            data-testid="suite-count"
          >
            {node.totalCount}
            <span className="sr-only"> test cases</span>
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" aria-label={`Actions for suite ${node.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/p/${code}/cases/new?suite=${node.id}`}>
                  <Plus aria-hidden /> Add test case
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setEditing({ id: null, name: "", description: "", parentId: node.id })}>
                <FolderPlus aria-hidden /> Add sub-suite
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  setEditing({ id: node.id, name: node.name, description: node.description, parentId: node.parentId ?? "" })
                }
              >
                <Pencil aria-hidden /> Edit / move
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  setDeleteMode("");
                  setMoveTarget("");
                  setDeleting(node);
                }}
              >
                <Trash2 aria-hidden /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {hasChildren && open && <ul role="group">{node.children.map((c) => renderNode(c, depth + 1))}</ul>}
      </li>
    );
  };

  const subtree = deleting ? descendantIds(suites, deleting.id) : [];
  const hasCases = (deleting?.totalCount ?? 0) > 0;

  return (
    <>
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm text-muted-foreground">{suites.length} suites</span>
        <Button size="sm" onClick={() => setEditing({ id: null, name: "", description: "", parentId: "" })}>
          <FolderPlus aria-hidden /> New suite
        </Button>
      </div>
      {tree.length ? (
        <ul role="tree" aria-label="Suites" className="p-2">
          {tree.map((n) => renderNode(n, 0))}
        </ul>
      ) : (
        <EmptyState
          icon={FolderTree}
          title="No suites yet"
          description="Create a suite to start organizing test cases."
          action={<Button onClick={() => setEditing({ id: null, name: "", description: "", parentId: "" })}>New suite</Button>}
        />
      )}

      <SuiteDialog
        projectId={projectId}
        suites={options}
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete suite "${deleting?.name}"?`}
        description={
          hasCases
            ? `This suite${subtree.length > 1 ? ` and its ${subtree.length - 1} sub-suite(s)` : ""} contain ${deleting?.totalCount} test case(s). Choose what happens to them.`
            : `This suite${subtree.length > 1 ? ` and its ${subtree.length - 1} empty sub-suite(s)` : ""} will be deleted.`
        }
        confirmLabel="Delete suite"
        onConfirm={async () => {
          if (!deleting) return false;
          if (hasCases && !deleteMode) {
            toast.error("Choose whether to move or delete the test cases.");
            return false;
          }
          if (deleteMode === "move" && !moveTarget) {
            toast.error("Choose a destination suite.");
            return false;
          }
          const res = await deleteSuite({
            projectId,
            id: deleting.id,
            mode: hasCases ? deleteMode : "block",
            targetSuiteId: deleteMode === "move" ? moveTarget : undefined,
          });
          if (res.ok) {
            toast.success(res.message);
            router.refresh();
          } else toast.error(res.error);
          return res.ok;
        }}
      >
        {hasCases && (
          <div className="flex flex-col gap-3">
            <RadioGroup value={deleteMode} onValueChange={(v) => setDeleteMode(v as "move" | "delete")}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="move" id="del-move" />
                <Label htmlFor="del-move">Move the test cases to another suite</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="delete" id="del-delete" />
                <Label htmlFor="del-delete" className="text-destructive">
                  Permanently delete the test cases
                </Label>
              </div>
            </RadioGroup>
            {deleteMode === "move" && (
              <SuiteSelect
                id="del-target"
                options={options}
                value={moveTarget}
                onChange={setMoveTarget}
                disabledIds={subtree}
                placeholder="Destination suite"
              />
            )}
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}
