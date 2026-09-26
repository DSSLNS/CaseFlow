"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Download, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/common/field";
import { NONE, SuiteSelect } from "@/components/common/suite-select";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { StepsEditor } from "./steps-editor";
import { TagInput } from "./tag-input";
import { deleteAttachment, saveTestCase } from "@/server/actions/cases";
import { AUTOMATION_STATUSES, CASE_STATUSES, CASE_TYPES, MAX_ATTACHMENT_BYTES, PRIORITIES } from "@/lib/constants";
import { formatBytes, formatDateTime } from "@/lib/format";
import type { SuiteOption } from "@/lib/suite-tree";
import { testCaseSchema, type TestCaseInput } from "@/lib/validation";

export type FormProject = { id: string; name: string; code: string; severities: string[]; suites: SuiteOption[] };
export type ExistingAttachment = { id: string; filename: string; size: number; uploadedBy: string | null };
export type CaseMeta = {
  key: string;
  createdBy: string | null;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
};

type SubmitMode = "save" | "another" | "draft";

function EnumSelect({
  id,
  value,
  onChange,
  options,
  invalid,
  allowNone,
  noneLabel = "None",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[] | { value: string; label: string }[];
  invalid?: boolean;
  allowNone?: boolean;
  noneLabel?: string;
}) {
  const opts = (options as (string | { value: string; label: string })[]).map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );
  return (
    <Select value={value || (allowNone ? NONE : "")} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger id={id} className="w-full" aria-invalid={invalid || undefined}>
        <SelectValue placeholder="Select…" />
      </SelectTrigger>
      <SelectContent position="popper">
        {allowNone && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
        {opts.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CaseForm({
  caseId,
  defaults,
  projects,
  users,
  attachments = [],
  meta,
  cancelHref,
}: {
  caseId: string | null;
  defaults: TestCaseInput;
  projects: FormProject[];
  users: { id: string; name: string }[];
  attachments?: ExistingAttachment[];
  meta?: CaseMeta;
  cancelHref: string;
}) {
  const router = useRouter();
  const form = useForm<TestCaseInput>({ resolver: zodResolver(testCaseSchema), defaultValues: defaults, mode: "onTouched" });
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = form;
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [existing, setExisting] = useState(attachments);
  const [removeAtt, setRemoveAtt] = useState<ExistingAttachment | null>(null);
  const [submitMode, setSubmitMode] = useState<SubmitMode | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const projectId = useWatch({ control, name: "projectId" });
  const project = projects.find((p) => p.id === projectId);
  const titleValue = useWatch({ control, name: "title" });

  async function uploadFiles(id: string): Promise<boolean> {
    if (!pendingFiles.length) return true;
    const body = new FormData();
    pendingFiles.forEach((f) => body.append("files", f));
    try {
      const res = await fetch(`/api/test-cases/${id}/attachments`, { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setPendingFiles([]);
      return true;
    } catch (e) {
      toast.error(`Test case saved, but attachments were not uploaded: ${e instanceof Error ? e.message : "upload failed"}`);
      return false;
    }
  }

  const submit = (mode: SubmitMode) =>
    handleSubmit(async (values) => {
      setSubmitMode(mode);
      try {
        const payload = mode === "draft" ? { ...values, status: "Draft" as const } : values;
        const res = await saveTestCase(caseId, payload);
        if (!res.ok) {
          for (const [field, msgs] of Object.entries(res.fieldErrors ?? {})) {
            if (msgs?.[0]) setError(field as keyof TestCaseInput, { message: msgs[0] });
          }
          toast.error(res.error);
          return;
        }
        const uploaded = await uploadFiles(res.data.id);
        toast.success(res.message);
        const viewHref = `/p/${res.data.projectCode}/cases/${res.data.key}`;
        if (!uploaded) {
          router.push(`${viewHref}/edit`);
        } else if (mode === "another") {
          reset({ ...defaults, projectId: values.projectId, suiteId: values.suiteId });
          if (caseId) router.push(`/p/${res.data.projectCode}/cases/new?suite=${values.suiteId}`);
          else window.scrollTo({ top: 0 });
          router.refresh();
        } else {
          router.push(viewHref);
          router.refresh();
        }
      } finally {
        setSubmitMode(null);
      }
    }, () => toast.error("Please fix the highlighted fields."));

  const busy = isSubmitting || submitMode !== null;

  return (
    <form onSubmit={submit("save")} noValidate aria-label={caseId ? "Edit test case" : "Create test case"}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">General</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Field id="title" label="Title" required error={errors.title?.message} hint={`${titleValue?.length ?? 0}/255`}>
                <Input
                  id="title"
                  autoFocus={!caseId}
                  aria-invalid={!!errors.title || undefined}
                  aria-describedby={errors.title ? "title-error" : "title-hint"}
                  placeholder="e.g. Login with valid credentials"
                  {...register("title")}
                />
              </Field>
              <Field id="description" label="Description" error={errors.description?.message} hint="What this test verifies and why.">
                <Textarea id="description" rows={3} aria-describedby="description-hint" {...register("description")} />
              </Field>
              <Field
                id="preconditions"
                label="Preconditions"
                error={errors.preconditions?.message}
                hint="State, data or setup required before the first step. One item per line."
              >
                <Textarea id="preconditions" rows={3} aria-describedby="preconditions-hint" {...register("preconditions")} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Steps & expected results</CardTitle>
            </CardHeader>
            <CardContent>
              <StepsEditor control={control} register={register} errors={errors} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Attachments</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                Files are stored on this server&apos;s local disk (max {MAX_ATTACHMENT_BYTES / 1024 / 1024} MB each) and upload when you save.
              </p>
              {existing.length > 0 && (
                <ul className="flex flex-col gap-1" aria-label="Saved attachments">
                  {existing.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
                      <Paperclip className="size-4 text-muted-foreground" aria-hidden />
                      <a href={`/api/attachments/${a.id}`} className="min-w-0 flex-1 truncate hover:underline">
                        {a.filename}
                      </a>
                      <span className="text-xs text-muted-foreground">{formatBytes(a.size)}</span>
                      <Button type="button" variant="ghost" size="icon-xs" asChild>
                        <a href={`/api/attachments/${a.id}`} aria-label={`Download ${a.filename}`}>
                          <Download />
                        </a>
                      </Button>
                      <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove ${a.filename}`} onClick={() => setRemoveAtt(a)}>
                        <X />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {pendingFiles.length > 0 && (
                <ul className="flex flex-col gap-1" aria-label="Files to upload">
                  {pendingFiles.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md border border-dashed px-2 py-1.5 text-sm">
                      <Paperclip className="size-4 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{f.name}</span>
                      <span className="text-xs text-muted-foreground">{formatBytes(f.size)} · uploads on save</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove ${f.name}`}
                        onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))}
                      >
                        <X />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div>
                <input
                  ref={fileRef}
                  id="attachments"
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    const files = [...(e.target.files ?? [])];
                    const tooBig = files.filter((f) => f.size > MAX_ATTACHMENT_BYTES);
                    if (tooBig.length) toast.error(`${tooBig.map((f) => f.name).join(", ")} exceed the size limit and were not added.`);
                    setPendingFiles((p) => [...p, ...files.filter((f) => f.size <= MAX_ATTACHMENT_BYTES)]);
                    e.target.value = "";
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Paperclip aria-hidden /> Add files
                </Button>
                <label htmlFor="attachments" className="sr-only">
                  Attachments
                </label>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Properties</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3.5">
              <Field id="caseKey" label="Test Case ID" hint={meta ? "Auto-generated; read-only." : "Assigned automatically when saved."}>
                <Input id="caseKey" readOnly value={meta?.key ?? "New"} className="bg-muted font-mono" aria-describedby="caseKey-hint" />
              </Field>
              <Field id="projectId" label="Project" required error={errors.projectId?.message}>
                <Controller
                  control={control}
                  name="projectId"
                  render={({ field }) => (
                    <EnumSelect
                      id="projectId"
                      value={field.value}
                      invalid={!!errors.projectId}
                      onChange={(v) => {
                        field.onChange(v);
                        // Suites and severities are per project.
                        setValue("suiteId", "", { shouldValidate: false });
                        const next = projects.find((p) => p.id === v);
                        if (next && !next.severities.includes(form.getValues("severity"))) setValue("severity", "");
                      }}
                      options={projects.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }))}
                    />
                  )}
                />
              </Field>
              <Field id="suiteId" label="Suite" required error={errors.suiteId?.message}>
                <Controller
                  control={control}
                  name="suiteId"
                  render={({ field }) => (
                    <SuiteSelect
                      id="suiteId"
                      options={project?.suites ?? []}
                      value={field.value}
                      onChange={field.onChange}
                      invalid={!!errors.suiteId}
                      placeholder={project?.suites.length ? "Select a suite" : "This project has no suites"}
                    />
                  )}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 xl:grid-cols-2">
                <Field id="priority" label="Priority" error={errors.priority?.message}>
                  <Controller
                    control={control}
                    name="priority"
                    render={({ field }) => <EnumSelect id="priority" value={field.value} onChange={field.onChange} options={PRIORITIES} />}
                  />
                </Field>
                <Field id="status" label="Status" error={errors.status?.message}>
                  <Controller
                    control={control}
                    name="status"
                    render={({ field }) => <EnumSelect id="status" value={field.value} onChange={field.onChange} options={CASE_STATUSES} />}
                  />
                </Field>
                <Field id="type" label="Type" error={errors.type?.message}>
                  <Controller
                    control={control}
                    name="type"
                    render={({ field }) => <EnumSelect id="type" value={field.value} onChange={field.onChange} options={CASE_TYPES} />}
                  />
                </Field>
                <Field id="severity" label="Severity" error={errors.severity?.message}>
                  <Controller
                    control={control}
                    name="severity"
                    render={({ field }) => (
                      <EnumSelect
                        id="severity"
                        value={field.value}
                        onChange={field.onChange}
                        options={project?.severities ?? []}
                        allowNone
                        noneLabel="Not set"
                        invalid={!!errors.severity}
                      />
                    )}
                  />
                </Field>
              </div>
              <Field id="assigneeId" label="Assignee" error={errors.assigneeId?.message}>
                <Controller
                  control={control}
                  name="assigneeId"
                  render={({ field }) => (
                    <EnumSelect
                      id="assigneeId"
                      value={field.value}
                      onChange={field.onChange}
                      options={users.map((u) => ({ value: u.id, label: u.name }))}
                      allowNone
                      noneLabel="Unassigned"
                    />
                  )}
                />
              </Field>
              <Field id="tags" label="Tags" error={errors.tags?.message ?? errors.tags?.[0]?.message} hint="Press Enter or comma to add.">
                <Controller
                  control={control}
                  name="tags"
                  render={({ field }) => (
                    <TagInput id="tags" value={field.value} onChange={field.onChange} invalid={!!errors.tags} describedBy="tags-hint" />
                  )}
                />
              </Field>
              <Field id="estimate" label="Estimate" error={errors.estimate?.message} hint="e.g. 15m, 1h, 1h 30m">
                <Input
                  id="estimate"
                  placeholder="e.g. 30m"
                  aria-invalid={!!errors.estimate || undefined}
                  aria-describedby={errors.estimate ? "estimate-error" : "estimate-hint"}
                  {...register("estimate")}
                />
              </Field>
              <Field id="automationStatus" label="Automation status" error={errors.automationStatus?.message}>
                <Controller
                  control={control}
                  name="automationStatus"
                  render={({ field }) => (
                    <EnumSelect id="automationStatus" value={field.value} onChange={field.onChange} options={AUTOMATION_STATUSES} />
                  )}
                />
              </Field>
              <Field
                id="automationRef"
                label="Automation reference"
                error={errors.automationRef?.message}
                hint="Test file, test ID or URL"
              >
                <Input
                  id="automationRef"
                  placeholder="e.g. e2e/login.spec.ts"
                  aria-describedby={errors.automationRef ? "automationRef-error" : "automationRef-hint"}
                  {...register("automationRef")}
                />
              </Field>
            </CardContent>
          </Card>

          {meta && (
            <Card>
              <CardContent className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                <span className="text-muted-foreground">Created by</span>
                <span data-testid="meta-created">
                  {meta.createdBy ?? "—"} · {formatDateTime(meta.createdAt)}
                </span>
                <span className="text-muted-foreground">Updated by</span>
                <span data-testid="meta-updated">
                  {meta.updatedBy ?? "—"} · {formatDateTime(meta.updatedAt)}
                </span>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 mt-4 flex flex-wrap items-center justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Button type="button" variant="ghost" asChild>
          <Link href={cancelHref} aria-disabled={busy}>
            Cancel
          </Link>
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={submit("draft")}>
          {submitMode === "draft" && <Loader2 className="animate-spin" aria-hidden />}
          Save as draft
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={submit("another")}>
          {submitMode === "another" && <Loader2 className="animate-spin" aria-hidden />}
          Save and add another
        </Button>
        <Button type="submit" disabled={busy}>
          {submitMode === "save" && <Loader2 className="animate-spin" aria-hidden />}
          Save
        </Button>
      </div>

      <ConfirmDialog
        open={!!removeAtt}
        onOpenChange={(o) => !o && setRemoveAtt(null)}
        title={`Remove ${removeAtt?.filename}?`}
        description="The file is deleted from storage immediately."
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!removeAtt) return false;
          const res = await deleteAttachment(removeAtt.id);
          if (res.ok) {
            toast.success(res.message);
            setExisting((e) => e.filter((a) => a.id !== removeAtt.id));
          } else toast.error(res.error);
          return res.ok;
        }}
      />
    </form>
  );
}
