"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProjectError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 text-center">
      <AlertTriangle className="size-8 text-destructive" aria-hidden />
      <h1 className="text-lg font-semibold">This page failed to load</h1>
      <p className="text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred while loading data."}
        {error.digest && <span className="block font-mono text-xs">Reference: {error.digest}</span>}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
