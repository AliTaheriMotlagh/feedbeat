"use client";

import { ArrowRight, AtSign, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const EXAMPLES = ["questlove", "zanelowe", "pitchfork", "kexp"];

export function ScanForm({
  size = "lg",
  className,
  autoFocus,
  defaultHandle = "",
}: {
  size?: "lg" | "sm";
  className?: string;
  autoFocus?: boolean;
  defaultHandle?: string;
}) {
  const router = useRouter();
  const [handle, setHandle] = useState(defaultHandle);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(value: string) {
    const clean = value.trim().replace(/^@/, "");
    if (!clean) {
      setError("Enter an X handle, e.g. @questlove");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: clean }),
      });
      const data = (await res.json().catch(() => ({}))) as { handle?: string; error?: string; isNewDiscovery?: boolean };
      if (!res.ok || !data.handle) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      if (data.isNewDiscovery) toast.success("New discovery! You'll earn XP when the scan finishes. 🧭");
      router.push(`/u/${data.handle}`);
    });
  }

  const lg = size === "lg";
  return (
    <div className={cn("w-full", className)}>
      <form
        role="search"
        aria-label="Turn an X profile into playlists"
        onSubmit={(e) => {
          e.preventDefault();
          submit(handle);
        }}
        className={cn(
          "group relative flex items-center gap-2 rounded-full border border-border bg-card/80 p-1.5 shadow-xl shadow-violet-500/5 backdrop-blur transition focus-within:border-ring focus-within:ring-4 focus-within:ring-ring/20",
          !lg && "shadow-none",
        )}
      >
        <label htmlFor={`handle-${size}`} className="sr-only">
          X username
        </label>
        <AtSign aria-hidden className={cn("ml-3 shrink-0 text-muted-foreground", lg ? "size-5" : "size-4")} />
        <input
          id={`handle-${size}`}
          name="handle"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="username on X"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus={autoFocus}
          maxLength={64}
          aria-invalid={!!error}
          aria-describedby={error ? `handle-error-${size}` : undefined}
          className={cn("min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground", lg ? "h-11 text-lg" : "h-8 text-sm")}
        />
        <Button type="submit" variant="gradient" size={lg ? "lg" : "sm"} disabled={pending} className="shrink-0">
          {pending ? <Loader2 className="animate-spin" /> : <ArrowRight />}
          <span className={cn(!lg && "sr-only sm:not-sr-only")}>{pending ? "Scanning…" : "Make playlists"}</span>
        </Button>
      </form>
      <p id={`handle-error-${size}`} role="alert" className="mt-2 min-h-5 px-4 text-sm text-destructive">
        {error}
      </p>
      {lg && (
        <p className="px-4 text-sm text-muted-foreground">
          Try{" "}
          {EXAMPLES.map((ex, i) => (
            <span key={ex}>
              <button
                type="button"
                onClick={() => {
                  setHandle(ex);
                  submit(ex);
                }}
                className="font-medium text-foreground underline decoration-dotted underline-offset-4 hover:text-primary"
              >
                @{ex}
              </button>
              {i < EXAMPLES.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
