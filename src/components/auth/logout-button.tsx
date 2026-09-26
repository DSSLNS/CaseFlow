"use client";

import { useTransition } from "react";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/server/actions/auth";

export function LogoutButton({ variant = "ghost" }: { variant?: "ghost" | "outline" }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={variant}
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => logout())}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LogOut className="size-4" aria-hidden />}
      Sign out
    </Button>
  );
}
