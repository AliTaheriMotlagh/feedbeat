"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PLATFORM_IDS } from "@/lib/platforms";
import { PlatformIcon } from "./platform-icon";

interface Status {
  status: "queued" | "scanning" | "ready" | "error";
  message: string | null;
  trackCount: number;
}

/** Live progress while a profile is being scanned; refreshes the page when done. */
export function ScanStatus({ handle, initialMessage }: { handle: string; initialMessage: string | null }) {
  const router = useRouter();
  const [message, setMessage] = useState(initialMessage ?? "Queued…");

  useEffect(() => {
    let alive = true;
    let delay = 1500;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch(`/api/profiles/${handle}/status`, { cache: "no-store" });
        if (res.ok) {
          const s = (await res.json()) as Status;
          if (!alive) return;
          if (s.status === "ready" || s.status === "error") {
            if (s.status === "ready") toast.success(`Found ${s.trackCount} songs for @${handle} 🎧`);
            router.refresh();
            return;
          }
          if (s.message) setMessage(s.message);
        }
      } catch {
        /* network blip — keep polling */
      }
      delay = Math.min(delay * 1.15, 5000);
      timer = setTimeout(poll, delay);
    }

    timer = setTimeout(poll, delay);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [handle, router]);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 text-center sm:p-12" aria-live="polite">
      <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-fuchsia-500/10 via-transparent to-cyan-500/10" />
      <div className="relative mx-auto mb-6 flex h-16 items-end justify-center gap-1.5" aria-hidden>
        {Array.from({ length: 9 }, (_, i) => (
          <span
            key={i}
            className="w-2 origin-bottom rounded-full bg-linear-to-t from-violet-500 to-cyan-400 motion-safe:animate-equalizer"
            style={{ height: "100%", animationDelay: `${(i % 4) * 0.15 + i * 0.05}s` }}
          />
        ))}
      </div>
      <h2 className="relative font-display text-2xl font-bold">Digging through @{handle}&apos;s posts</h2>
      <p className="relative mt-2 text-muted-foreground">{message}</p>
      <div className="relative mt-6 flex justify-center gap-3 text-muted-foreground">
        {PLATFORM_IDS.map((p, i) => (
          <span key={p} className="opacity-60 motion-safe:animate-pulse" style={{ animationDelay: `${i * 0.2}s` }}>
            <PlatformIcon platform={p} className="size-5" colored />
          </span>
        ))}
      </div>
      <p className="relative mt-6 text-xs text-muted-foreground">This usually takes 10–60 seconds. You can leave — we&apos;ll keep going.</p>
    </div>
  );
}
