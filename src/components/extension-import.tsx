"use client";

import { Loader2, Lock, Puzzle, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSession } from "@/lib/auth-client";
import { publishImport, type ImportPayload } from "@/lib/import-client";
import { parseMusicUrl, PLATFORMS, type PlatformId } from "@/lib/platforms";
import { useAuthPrompt } from "./auth-prompt";
import { Avatar } from "./avatar";
import { PlatformIcon } from "./platform-icon";

type State =
  | { step: "waiting" }
  | { step: "empty" }
  | { step: "ready"; batch: ImportPayload }
  | { step: "uploading"; batch: ImportPayload; done: number; total: number }
  | { step: "error"; batch: ImportPayload; message: string };

/** Receives the batch from the Feedbeat Collector extension and publishes it on request. */
export function ExtensionImport() {
  const [state, setState] = useState<State>({ step: "waiting" });
  const { data: session } = useSession();
  const prompt = useAuthPrompt();
  const router = useRouter();

  useEffect(() => {
    let answered = false;
    // The extension's bridge replies once, with the batch or null.
    function onMessage(e: MessageEvent) {
      if (e.source !== window || e.data?.source !== "feedbeat-extension" || e.data.type !== "batch" || answered) return;
      answered = true;
      const batch = e.data.batch as ImportPayload | null;
      setState(batch && Array.isArray(batch.items) ? { step: "ready", batch } : { step: "empty" });
    }
    window.addEventListener("message", onMessage);
    window.postMessage({ source: "feedbeat-page", type: "ready" }, window.location.origin);
    // No reply means the extension isn't installed, or this tab was opened by hand.
    const timer = setTimeout(() => {
      if (!answered) setState({ step: "empty" });
    }, 3000);
    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
    };
  }, []);

  const batch = state.step === "ready" || state.step === "uploading" || state.step === "error" ? state.batch : null;

  const byPlatform = useMemo(() => {
    const counts: Partial<Record<PlatformId, number>> = {};
    for (const item of batch?.items ?? []) {
      const p = parseMusicUrl(item.url)?.platform;
      if (p) counts[p] = (counts[p] ?? 0) + 1;
    }
    return counts;
  }, [batch]);

  async function publish(b: ImportPayload) {
    if (!session) return prompt("Sign in to publish your playlists and earn XP.");
    setState({ step: "uploading", batch: b, done: 0, total: b.items.length });
    try {
      const { handle, total } = await publishImport(b, (done, all) => setState({ step: "uploading", batch: b, done, total: all }));
      toast.success(`Published ${total} songs 🎉`);
      router.push(`/u/${handle}`);
    } catch (err) {
      setState({ step: "error", batch: b, message: err instanceof Error ? err.message : "Upload failed." });
    }
  }

  if (state.step === "waiting") {
    return <p className="mt-10 text-center text-sm text-muted-foreground">Looking for your collected songs…</p>;
  }

  if (state.step === "empty") {
    return (
      <div className="mt-10 rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center">
        <Puzzle className="mx-auto size-10 text-primary" />
        <p className="mt-4 font-display text-xl font-bold">Nothing to publish yet</p>
        <ol className="mx-auto mt-4 max-w-sm space-y-1 text-left text-sm text-muted-foreground">
          <li>1. Install the Feedbeat Collector extension in Chrome.</li>
          <li>2. Sign in to X, open your own profile and click the extension.</li>
          <li>3. Keep the X tab open while it scrolls. This page then opens with your songs.</li>
        </ol>
      </div>
    );
  }

  if (state.step === "uploading") {
    return (
      <div className="mt-10 rounded-3xl border border-border bg-card p-8 text-center" aria-live="polite">
        <Loader2 className="mx-auto size-8 animate-spin text-primary" />
        <p className="mt-4 font-display text-xl font-bold">Building @{state.batch.account.username}&apos;s playlists…</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {state.done} / {state.total} songs · fetching titles & artwork
        </p>
        <Progress value={state.total ? state.done / state.total : 1} className="mx-auto mt-6 max-w-sm" label="Upload progress" />
        <p className="mt-4 text-xs text-muted-foreground">Keep this tab open until it finishes.</p>
      </div>
    );
  }

  if (!batch) return null;
  const found = batch.items.length;

  return (
    <div className="mt-10 rounded-3xl border border-border bg-card p-6 sm:p-8">
      <div className="flex items-center gap-4">
        <Avatar src={batch.profile.avatarUrl} name={batch.account.username} className="size-14" />
        <div className="min-w-0">
          <p className="truncate font-display text-xl font-bold">@{batch.account.username}</p>
          <p className="text-sm text-muted-foreground">{batch.tweetsScanned.toLocaleString("en-US")} of your posts read in your browser</p>
        </div>
      </div>

      {found === 0 ? (
        <p className="mt-6 rounded-2xl bg-muted p-5 text-center">No music links found in your posts.</p>
      ) : (
        <>
          <p className="mt-6 font-display text-3xl font-extrabold">
            {found.toLocaleString("en-US")} <span className="text-gradient">songs found</span>
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {(Object.entries(byPlatform) as [PlatformId, number][]).map(([p, n]) => (
              <li key={p} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm">
                <PlatformIcon platform={p} colored /> {PLATFORMS[p].name} <span className="font-semibold">{n}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 flex items-start gap-2 text-sm text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0" />
            Only these music links (with post date and text) are uploaded. Nothing else leaves your browser.
          </p>
          {state.step === "error" && (
            <p role="alert" className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {state.message}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            <Button size="lg" variant="gradient" onClick={() => publish(batch)}>
              <UploadCloud /> {session ? "Publish my playlists" : "Sign in & publish"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
