"use client";

import { CheckCircle2, History, Link2, Loader2, Lock, Pause, Play, Puzzle, RefreshCw, RotateCcw, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSession } from "@/lib/auth-client";
import { publishImport } from "@/lib/import-client";
import { isPlatformId, PLATFORMS } from "@/lib/platforms";
import { useExtension, type ScanSummary, type StartKind } from "@/lib/use-extension";
import { cn } from "@/lib/utils";
import { useAuthPrompt } from "./auth-prompt";
import { PlatformIcon } from "./platform-icon";

const EXTENSION_URL = process.env.NEXT_PUBLIC_EXTENSION_URL;

const fmt = (n: number) => n.toLocaleString("en-US");
const month = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });

type Upload = { done: number; total: number } | null;

/** Runs the Feedbeat Collector extension's scan from the site, then publishes what it found. */
export function ExtensionImport() {
  const { status, scan, signedIn, command } = useExtension();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upload, setUpload] = useState<Upload>(null);
  const { data: session } = useSession();
  const prompt = useAuthPrompt();
  const router = useRouter();

  async function run(type: string, payload?: unknown) {
    setBusy(true);
    setError(null);
    try {
      return await command(type, payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  const start = (kind: StartKind) => run("start", { kind });

  async function publish() {
    if (!session) return prompt("Sign in to publish your playlists and earn XP.");
    const reply = await run("batch");
    const batch = reply?.ok ? reply.batch : null;
    if (!batch) return;
    setUpload({ done: 0, total: batch.items.length });
    try {
      const { handle, total } = await publishImport(batch, (done, all) => setUpload({ done, total: all }));
      await command("published", { count: batch.items.length }).catch(() => {});
      toast.success(`Published ${fmt(total)} songs 🎉`);
      router.push(`/u/${handle}`);
    } catch (err) {
      setUpload(null);
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  if (status === "detecting") {
    return <p className="mt-10 text-center text-sm text-muted-foreground">Looking for the Feedbeat Collector extension…</p>;
  }
  if (status === "missing") return <InstallSteps />;

  if (upload) {
    return (
      <Card aria-live="polite" className="text-center">
        <Loader2 className="mx-auto size-8 animate-spin text-primary" />
        <p className="mt-4 font-display text-xl font-bold">Building @{scan?.handle}&apos;s playlists…</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {fmt(upload.done)} / {fmt(upload.total)} songs · fetching titles & artwork
        </p>
        <Progress value={upload.total ? upload.done / upload.total : 1} className="mx-auto mt-6 max-w-sm" label="Upload progress" />
        <p className="mt-4 text-xs text-muted-foreground">Keep this tab open until it finishes.</p>
      </Card>
    );
  }

  const active = scan?.status === "running" || scan?.status === "cooldown";
  const canPublish = !!scan?.songs && !active;

  return (
    <Card>
      {!scan || scan.status === "idle" ? (
        <Intro signedIn={signedIn} />
      ) : (
        <ScanView scan={scan} />
      )}

      {error && (
        <p role="alert" className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {active ? (
          <>
            <Button size="lg" variant="outline" disabled={busy} onClick={() => run("pause")}>
              <Pause /> Pause
            </Button>
            {scan.status === "cooldown" && (
              <Button size="lg" variant="ghost" disabled={busy} onClick={() => start("continue")}>
                <Play /> Try now
              </Button>
            )}
          </>
        ) : (
          <>
            {canPublish && (
              <Button size="lg" variant="gradient" disabled={busy} onClick={publish}>
                <UploadCloud />
                {session ? `Publish ${fmt(scan.songs)} songs` : "Sign in & publish"}
              </Button>
            )}
            {!scan?.scanned ? (
              <Button size="lg" variant={canPublish ? "outline" : "gradient"} disabled={busy || !signedIn} onClick={() => start("continue")}>
                <Play /> Start scanning my posts
              </Button>
            ) : !scan.complete ? (
              <Button size="lg" variant="outline" disabled={busy} onClick={() => start("continue")}>
                <History /> Continue older posts
              </Button>
            ) : null}
            {!!scan?.newest && (
              <Button size="lg" variant="outline" disabled={busy} onClick={() => start("new")}>
                <RefreshCw /> Check for new posts
              </Button>
            )}
            {!!scan && scan.status !== "idle" && (
              <Button
                size="lg"
                variant="ghost"
                disabled={busy}
                onClick={() => confirm("Forget everything collected so far? Songs you already published stay on Feedbeat.") && run("reset")}
              >
                <RotateCcw /> Start over
              </Button>
            )}
          </>
        )}
      </div>

      <p className="mt-5 flex items-start gap-2 text-sm text-muted-foreground">
        <Lock className="mt-0.5 size-4 shrink-0" />
        Your posts are read in your own browser. Only the music links (with post date and text) are uploaded, and only when you publish.
      </p>
    </Card>
  );
}

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mt-10 rounded-3xl border border-border bg-card p-6 sm:p-8", className)} {...props} />;
}

function Intro({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      <p className="font-display text-2xl font-bold">Scan your X posts for music</p>
      <ol className="mt-4 space-y-2 text-sm text-muted-foreground">
        <li>1. A small X window opens and reads your posts that contain links, newest first, back to your very first post.</li>
        <li>2. Keep that window on screen. X only loads posts while it&apos;s visible. Progress shows up here live.</li>
        <li>3. Pause any time, even close the browser: it continues where it left off. Publish whenever you like.</li>
      </ol>
      {!signedIn && (
        <p className="mt-4 rounded-2xl bg-muted p-4 text-sm">
          Sign in to{" "}
          <a href="https://x.com/login" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
            X
          </a>{" "}
          in this browser first, then reload this page.
        </p>
      )}
    </>
  );
}

function ScanView({ scan }: { scan: ScanSummary }) {
  const platforms = Object.entries(scan.platforms).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="truncate font-display text-xl font-bold">@{scan.handle ?? "…"}</p>
        <StatusPill scan={scan} />
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="songs found" value={fmt(scan.songs)} />
        <Stat label="posts read" value={fmt(scan.scanned)} />
        <Stat label={scan.complete ? "first post" : "reached"} value={scan.oldest ? month(scan.oldest) : "—"} />
      </dl>

      {scan.status === "running" && <Progress value={1} className="mt-5 animate-pulse" label="Scanning" />}

      <p className={cn("mt-4 text-sm", scan.status === "error" ? "text-destructive" : "text-muted-foreground")}>{describe(scan)}</p>

      {platforms.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {platforms.map(([p, n]) => (
            <li key={p} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm">
              {isPlatformId(p) ? <PlatformIcon platform={p} colored /> : <Link2 className="size-4" />}
              {isPlatformId(p) ? PLATFORMS[p].name : "Smart links"} <span className="font-semibold">{fmt(n)}</span>
            </li>
          ))}
        </ul>
      )}

      {scan.songs > 0 && scan.unpublished > 0 && scan.unpublished < scan.songs && (
        <p className="mt-3 text-sm font-medium text-primary">{fmt(scan.unpublished)} new since your last publish.</p>
      )}
    </>
  );
}

function describe(scan: ScanSummary): string {
  if (scan.message && scan.status !== "done") return scan.message;
  switch (scan.status) {
    case "running":
      return scan.mode === "new"
        ? "Looking for posts newer than your last scan…"
        : scan.oldest
          ? `Reading your posts from ${month(scan.oldest)} and earlier…`
          : "Opening your posts…";
    case "cooldown":
      return "X asked us to slow down. The scan continues automatically.";
    case "paused":
      return scan.oldest ? `Paused at ${month(scan.oldest)}. Continue any time; nothing is lost.` : "Paused.";
    case "done":
      return scan.complete
        ? "Your whole history is scanned. Publish, or check back later for new posts."
        : "Up to date. Older posts are still waiting: continue whenever you like.";
    default:
      return "";
  }
}

const PILL: Record<ScanSummary["status"], [string, string]> = {
  idle: ["Not started", "bg-muted text-muted-foreground"],
  running: ["Scanning", "bg-primary/10 text-primary"],
  cooldown: ["Waiting on X", "bg-amber-500/10 text-amber-600 dark:text-amber-400"],
  paused: ["Paused", "bg-muted text-muted-foreground"],
  done: ["Done", "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"],
  error: ["Needs attention", "bg-destructive/10 text-destructive"],
};

function StatusPill({ scan }: { scan: ScanSummary }) {
  const [label, tone] = PILL[scan.status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", tone)}>
      {scan.status === "running" && <Loader2 className="size-3.5 animate-spin" />}
      {scan.status === "done" && <CheckCircle2 className="size-3.5" />}
      {label}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted p-3">
      <dd className="font-display text-xl font-extrabold tabular-nums sm:text-2xl">{value}</dd>
      <dt className="text-xs text-muted-foreground">{label}</dt>
    </div>
  );
}

function InstallSteps() {
  return (
    <div className="mt-10 rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center">
      <Puzzle className="mx-auto size-10 text-primary" />
      <p className="mt-4 font-display text-xl font-bold">Install the Feedbeat Collector</p>
      <ol className="mx-auto mt-4 max-w-sm space-y-1 text-left text-sm text-muted-foreground">
        <li>1. Add the Feedbeat Collector extension to Chrome, Edge or Brave.</li>
        <li>2. Sign in to X in the same browser.</li>
        <li>3. Reload this page and start the scan right here.</li>
      </ol>
      {EXTENSION_URL && (
        <Button asChild size="lg" variant="gradient" className="mt-6">
          <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer">
            <Puzzle /> Get the extension
          </a>
        </Button>
      )}
    </div>
  );
}
