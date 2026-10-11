"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function RefreshButton({ handle, label = "Refresh" }: { handle: string; label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await fetch("/api/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ handle }),
          });
          const data = (await res.json().catch(() => ({}))) as { started?: boolean; error?: string };
          if (!res.ok) toast.error(data.error ?? "Couldn't refresh right now.");
          else if (!data.started) toast("Already up to date — check back in a few hours.");
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      {label}
    </Button>
  );
}
