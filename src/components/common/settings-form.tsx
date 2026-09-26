"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "./field";
import { ConfirmDialog } from "./confirm-dialog";
import { deleteProject, updateProjectSettings } from "@/server/actions/projects";

export function SettingsForm({
  project,
}: {
  project: { id: string; name: string; code: string; description: string; severities: string[] };
}) {
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [severities, setSeverities] = useState(project.severities.join("\n"));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmCode, setConfirmCode] = useState("");

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Project</CardTitle>
          <CardDescription>
            Project code <span className="font-mono">{project.code}</span> prefixes every test case ID and cannot be changed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (saving) return;
              setSaving(true);
              try {
                const res = await updateProjectSettings({
                  projectId: project.id,
                  name,
                  description,
                  severities: severities.split("\n").map((s) => s.trim()).filter(Boolean),
                });
                if (!res.ok) {
                  setErrors(Object.fromEntries(Object.entries(res.fieldErrors ?? {}).map(([k, v]) => [k, v?.[0] ?? ""])));
                  toast.error(res.error);
                  return;
                }
                setErrors({});
                toast.success(res.message);
                router.refresh();
              } finally {
                setSaving(false);
              }
            }}
          >
            <Field id="set-name" label="Name" required error={errors.name}>
              <Input id="set-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name || undefined} />
            </Field>
            <Field id="set-description" label="Description" error={errors.description}>
              <Textarea id="set-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <Field
              id="set-severities"
              label="Severity values"
              error={errors.severities ?? errors["severities.0"]}
              hint="One per line, in order. Used by the Severity field on test cases and during import. Existing cases keep their value."
            >
              <Textarea id="set-severities" rows={6} value={severities} onChange={(e) => setSeverities(e.target.value)} className="font-mono text-sm" />
            </Field>
            <div>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="animate-spin" aria-hidden />}
                Save settings
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Integrations</CardTitle>
          <CardDescription>External services are not connected. Everything below works without them.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y text-sm" data-testid="integrations">
            {[
              ["Google Drive (evidence upload)", "Evidence is added as links. Paste Drive links manually; files keep their Drive sharing settings."],
              ["Google Sheets (run sync)", "Export runs as CSV or XLSX from a run's report page instead."],
              ["Issue tracker", "Defect references on failed results are stored as plain text or links."],
            ].map(([name, note]) => (
              <li key={name} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:gap-3">
                <span className="font-medium sm:w-60">{name}</span>
                <span className="w-fit rounded-md border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Not configured</span>
                <span className="text-xs text-muted-foreground">{note}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-sm text-destructive">Danger zone</CardTitle>
          <CardDescription>Deleting the project removes all its suites, test cases, runs and import history.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            Delete project
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(o) => {
          setConfirmOpen(o);
          if (!o) setConfirmCode("");
        }}
        title={`Delete project ${project.name}?`}
        description={`This cannot be undone. Type ${project.code} to confirm.`}
        confirmLabel="Delete project"
        onConfirm={async () => {
          const res = await deleteProject(project.id, confirmCode);
          if (!res.ok) {
            toast.error(res.error);
            return false;
          }
          toast.success(res.message);
          router.push("/");
          router.refresh();
          return true;
        }}
      >
        <Input aria-label="Project code confirmation" value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} placeholder={project.code} />
      </ConfirmDialog>
    </div>
  );
}
