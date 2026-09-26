"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, Copy, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { archiveTestCases, deleteTestCases, duplicateTestCase } from "@/server/actions/cases";
import { toastResult } from "@/lib/toast-result";

export function CaseActions({
  projectId,
  code,
  caseId,
  caseKey,
  archived,
}: {
  projectId: string;
  code: string;
  caseId: string;
  caseKey: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = toastResult(await duplicateTestCase(projectId, caseId));
            if (res.ok) router.push(`/p/${code}/cases/${res.data.key}`);
          })
        }
      >
        <Copy aria-hidden /> Duplicate
      </Button>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = toastResult(await archiveTestCases(projectId, [caseId], !archived));
            if (res.ok) router.refresh();
          })
        }
      >
        {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />} {archived ? "Restore" : "Archive"}
      </Button>
      <Button variant="destructive" disabled={pending} onClick={() => setConfirm(true)}>
        <Trash2 aria-hidden /> Delete
      </Button>
      <Button asChild>
        <Link href={`/p/${code}/cases/${caseKey}/edit`}>
          <Pencil aria-hidden /> Edit
        </Link>
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${caseKey}?`}
        description="This permanently deletes the test case, its steps and attachments. Past test runs keep their recorded results."
        onConfirm={async () => {
          const res = toastResult(await deleteTestCases(projectId, [caseId]));
          if (res.ok) {
            router.push(`/p/${code}/cases`);
            router.refresh();
          }
          return res.ok;
        }}
      />
    </>
  );
}
