"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileArchive,
  History,
  Link2,
  Loader2,
  Lock,
  Monitor,
  Pause,
  Play,
  Puzzle,
  RefreshCw,
  RotateCcw,
  Smartphone,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSession } from "@/lib/auth-client";
import { useExtensionSupport, type ExtensionSupport } from "@/lib/extension-support";
import { publishImport } from "@/lib/import-client";
import { isPlatformId, PLATFORMS } from "@/lib/platforms";
import { useExtension, type ScanSummary, type StartKind, type StartTarget } from "@/lib/use-extension";
import { cn } from "@/lib/utils";
import { useAuthPrompt } from "./auth-prompt";
import { PlatformIcon } from "./platform-icon";

const EXTENSION_URL = process.env.NEXT_PUBLIC_EXTENSION_URL;
/** No word from the X frame or tab for this long means it's stuck. */
const ATTACH_TIMEOUT = 20_000;
const STALL_TIMEOUT = 60_000;

const fmt = (n: number) => n.toLocaleString("en-US");
const month = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });

type Upload = { done: number; total: number } | null;

/** Runs the Feedbeat Collector extension's scan right on this page, then publishes what it found. */
export function ExtensionImport() {
  const { status, problem, scan, signedIn, here, command, recheck } = useExtension();
  const support = useExtensionSupport();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upload, setUpload] = useState<Upload>(null);
  const now = useNow(5_000);
  const { data: session, isPending: sessionPending } = useSession();
  const prompt = useAuthPrompt();
  const router = useRouter();
  const lastStatus = useRef(scan?.status);
  const wantPublish = useRef(false);

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

  // An X tab by default: inside a frame X often can't see its sign-in and stops loading when scrolled out of view.
  const start = (kind: StartKind, target: StartTarget = "tab") => run("start", { kind, target });

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

  // A scan that finishes while this page is open imports its songs right away.
  const publishIfWanted = useEffectEvent(() => {
    if (!wantPublish.current || sessionPending || busy || upload) return;
    wantPublish.current = false;
    if (scan?.status === "done" && scan.unpublished > 0) queueMicrotask(() => void publish());
  });

  useEffect(() => {
    if (lastStatus.current === "running" && scan?.status === "done") wantPublish.current = true;
    lastStatus.current = scan?.status;
    publishIfWanted();
  }, [scan?.status, sessionPending]);

  // The extension opens this page with ?publish when a scan started from its popup finishes.
  useEffect(() => {
    if (status !== "ready" || !new URLSearchParams(window.location.search).has("publish")) return;
    window.history.replaceState(null, "", window.location.pathname);
    wantPublish.current = true;
    publishIfWanted();
  }, [status]);

  // Phones and Firefox/Safari can't run a Chrome extension: don't make them wait to be told to install one.
  if (support && support !== "yes") return <Unsupported kind={support} />;
  if (status === "detecting") {
    return <p className="mt-10 text-center text-sm text-muted-foreground">Looking for the Feedbeat Collector extension…</p>;
  }
  if (status === "missing") return <Missing onCheckAgain={recheck} />;
  if (status === "broken") return <Broken problem={problem} onCheckAgain={recheck} />;

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

  const fresh = !scan || scan.status === "idle" || (!scan.scanned && scan.status === "paused");
  const active = scan?.status === "running" || scan?.status === "cooldown";
  const inFrame = scan?.target === "frame";
  const showFrame = !!scan && inFrame && here && (active || scan.status === "error");
  const elsewhere = !!scan && active && inFrame && !here;
  const updatedAgo = scan?.updatedAt ? now - Date.parse(scan.updatedAt) : 0;
  const notLoading = !!scan && scan.status === "running" && !scan.attached && updatedAgo > ATTACH_TIMEOUT;
  const stalled = !!scan && scan.status === "running" && scan.attached && updatedAgo > STALL_TIMEOUT;

  // One clear next step, then the rest.
  const next: Action[] = [];
  if (fresh) {
    next.push({ key: "start", label: "Scan my X posts", icon: Play, run: () => start("continue"), disabled: !signedIn });
  } else if (active) {
    next.push({ key: "pause", label: "Pause", icon: Pause, run: () => run("pause") });
    if (scan.status === "cooldown") next.push({ key: "now", label: "Try now", icon: Play, run: () => start("continue") });
  } else {
    const publishable = !!scan?.songs && (scan.unpublished > 0 || scan.status === "done");
    const more = !scan?.complete;
    const publishAction: Action = {
      key: "publish",
      label: session ? `Publish ${fmt(scan!.unpublished || scan!.songs)} songs` : "Sign in & publish",
      icon: UploadCloud,
      run: publish,
    };
    const continueAction: Action = { key: "continue", label: "Continue scanning", icon: History, run: () => start("continue") };
    // Signed out inside the frame: a normal tab still has the X sign-in.
    if (scan?.status === "error" && scan.target === "frame") {
      next.push({ key: "tab", label: "Scan in an X tab", icon: ExternalLink, run: () => start("continue", "tab") });
    }
    if (scan?.status === "done" && publishable) next.push(publishAction);
    if (more) next.push(continueAction);
    if (scan?.status !== "done" && publishable) next.push(publishAction);
    if (scan?.newest) next.push({ key: "new", label: "Check for new posts", icon: RefreshCw, run: () => start("new") });
  }

  return (
    <Card>
      {fresh ? <Intro signedIn={signedIn} /> : <ScanView scan={scan!} />}

      {error && <Alert tone="error">{error}</Alert>}
      {elsewhere && (
        <Alert>
          The scan is running in another Feedbeat tab. Keep that tab open, or{" "}
          <button className="font-semibold text-primary hover:underline" disabled={busy} onClick={() => start("continue")}>
            move it here
          </button>
          .
        </Alert>
      )}
      {notLoading && (
        <Alert>
          {inFrame ? "X isn't loading inside this page." : "Your X tab hasn't started yet."}{" "}
          <button className="font-semibold text-primary hover:underline" disabled={busy} onClick={() => start("continue", "tab")}>
            {inFrame ? "Scan in an X tab instead" : "Open it again"}
          </button>
        </Alert>
      )}
      {stalled && (
        <Alert>
          No progress for a minute.{" "}
          <button className="font-semibold text-primary hover:underline" disabled={busy} onClick={() => start("continue")}>
            Restart here
          </button>{" "}
          (nothing collected is lost).
        </Alert>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {next.map((a, i) => (
          <Button key={a.key} size="lg" variant={i === 0 ? "gradient" : "outline"} disabled={busy || a.disabled} onClick={a.run}>
            <a.icon /> {a.label}
          </Button>
        ))}
        {!fresh && !active && (
          <Button
            size="lg"
            variant="ghost"
            disabled={busy}
            onClick={() => confirm("Forget everything collected so far? Songs you already published stay on Feedbeat.") && run("reset")}
          >
            <RotateCcw /> Start over
          </Button>
        )}
      </div>
      {fresh && signedIn && (
        <p className="mt-3 text-sm text-muted-foreground">
          Rather stay on this page?{" "}
          <button className="font-medium text-primary hover:underline" disabled={busy} onClick={() => start("continue", "frame")}>
            Scan inside it
          </button>{" "}
          (doesn&apos;t work in every browser)
        </p>
      )}

      {showFrame && <ScanFrame key={scan.runId} src={scan.scanUrl} />}
      {active && !inFrame && (
        <p className="mt-5 flex items-center gap-2 rounded-2xl bg-muted p-4 text-sm">
          <ExternalLink className="size-4 shrink-0" />
          Scanning in your X tab. Keep it in front; when it&apos;s done you&apos;re brought back here and your songs are imported.
        </p>
      )}

      <p className="mt-5 flex items-start gap-2 text-sm text-muted-foreground">
        <Lock className="mt-0.5 size-4 shrink-0" />
        Your posts are read in your own browser. Only the music links (with post date and text) are uploaded, and only when you publish.
      </p>
    </Card>
  );
}

interface Action {
  key: string;
  label: string;
  icon: React.ComponentType;
  run: () => unknown;
  disabled?: boolean;
}

/**
 * Re-render every `ms` so time-based hints (stuck scans) appear.
 * Starts at 0 (no hints): the clock is only read after mount, never while prerendering.
 */
function useNow(ms: number) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/**
 * X, running inside this page. The extension drives it; the frame only has to
 * stay on screen, because X loads more posts only while it's visible.
 * `src` is read once per run: the scan moves the frame along by itself.
 */
function ScanFrame({ src }: { src: string }) {
  const [initial] = useState(src);
  return (
    <figure className="mt-6">
      <iframe
        src={initial}
        title="X, scanning your posts"
        referrerPolicy="no-referrer"
        className="h-[70vh] min-h-[420px] w-full rounded-2xl border border-border bg-background"
      />
      <figcaption className="mt-2 text-xs text-muted-foreground">
        This is X, scrolling through your posts by itself. Keep this tab in front until it&apos;s done; you can pause any time.
      </figcaption>
    </figure>
  );
}

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mt-10 rounded-3xl border border-border bg-card p-6 sm:p-8", className)} {...props} />;
}

function Alert({ tone, children }: { tone?: "error"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "mt-5 flex items-start gap-2 rounded-2xl border p-4 text-sm",
        tone === "error" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-amber-500/30 bg-amber-500/5",
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function Intro({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      <p className="font-display text-2xl font-bold">Find every song you&apos;ve posted on X</p>
      <ol className="mt-4 space-y-2 text-sm text-muted-foreground">
        <li>1. X opens in a new tab and scrolls through your posts, newest first, then searches back to your very first post.</li>
        <li>2. Keep that tab in front while it works. Songs show up here as they&apos;re found.</li>
        <li>3. When it&apos;s done you&apos;re brought back here and the songs are imported. Pause any time; it continues where it stopped.</li>
      </ol>
      {!signedIn && (
        <Alert>
          Sign in to{" "}
          <a href="https://x.com/login" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
            X
          </a>{" "}
          in this browser first, then come back here.
        </Alert>
      )}
    </>
  );
}

function ScanView({ scan }: { scan: ScanSummary }) {
  const platforms = Object.entries(scan.platforms).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="truncate font-display text-xl font-bold">{scan.handle ? `@${scan.handle}` : "Your X posts"}</p>
        <StatusPill scan={scan} />
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="songs found" value={fmt(scan.songs)} />
        <Stat label="posts read" value={fmt(scan.scanned)} />
        <Stat label={scan.complete ? "back to" : "reached"} value={scan.oldest ? month(scan.oldest) : "—"} />
      </dl>

      <p className={cn("mt-4 text-sm", scan.status === "error" ? "font-medium text-destructive" : "text-muted-foreground")}>{describe(scan)}</p>

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
    </>
  );
}

function describe(scan: ScanSummary): string {
  if (scan.message && scan.status !== "done") return scan.message;
  const published = scan.songs - scan.unpublished;
  const unpublishedNote = published > 0 && scan.unpublished > 0 ? ` ${fmt(scan.unpublished)} not published yet.` : "";
  switch (scan.status) {
    case "running":
      if (!scan.handle) return "Opening X…";
      return scan.mode === "new"
        ? "Looking for posts newer than your last scan…"
        : scan.phase === "profile"
          ? `Scrolling your profile${scan.oldest ? `, at ${month(scan.oldest)}` : ""}…`
          : scan.oldest
          ? `Reading your posts from ${month(scan.oldest)} and earlier…`
          : "Reading your latest posts…";
    case "cooldown":
      return "X asked us to slow down. The scan continues by itself in a few minutes.";
    case "paused":
      return `${scan.oldest ? `Paused at ${month(scan.oldest)}.` : "Paused."} Continue any time; nothing is lost.${unpublishedNote}`;
    case "done":
      return scan.complete
        ? `Your whole history is scanned.${unpublishedNote} Come back any time to check for new posts.`
        : `You're up to date with your latest posts. Older ones are still waiting.${unpublishedNote}`;
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

const IS_DEV = process.env.NODE_ENV !== "production";

function ArchiveButton({ variant = "gradient" }: { variant?: "gradient" | "outline" }) {
  return (
    <Button asChild size="lg" variant={variant}>
      <Link href="/import">
        <FileArchive /> Import my X archive instead
      </Link>
    </Button>
  );
}

/** A browser that can't run the extension: phones, Firefox, Safari. The archive works everywhere. */
function Unsupported({ kind }: { kind: Exclude<ExtensionSupport, "yes"> }) {
  const mobile = kind === "mobile";
  const Icon = mobile ? Smartphone : Monitor;
  return (
    <div className="mt-10 rounded-3xl border border-border bg-card p-8 text-center">
      <Icon className="mx-auto size-10 text-primary" />
      <p className="mt-4 font-display text-xl font-bold">{mobile ? "Scanning from X needs a computer" : "Scanning from X needs Chrome, Edge or Brave"}</p>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
        {mobile
          ? "The Feedbeat Collector is a browser extension, and phone browsers can't run extensions."
          : "The Feedbeat Collector is a Chrome extension, and this browser can't run it."}{" "}
        You can still turn your whole X history into playlists from here: ask X for your archive (it&apos;s free), then choose the .zip. Nothing leaves
        your {mobile ? "phone" : "browser"} except the music links.
      </p>
      <div className="mt-6 flex justify-center">
        <ArchiveButton />
      </div>
    </div>
  );
}

/** Desktop Chromium, but nothing answered: not installed, or not installed *for this address*. */
function Missing({ onCheckAgain }: { onCheckAgain: () => void }) {
  return (
    <div className="mt-10 rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center">
      <Puzzle className="mx-auto size-10 text-primary" />
      <p className="mt-4 font-display text-xl font-bold">Feedbeat Collector not found</p>
      {EXTENSION_URL ? (
        <ol className="mx-auto mt-4 max-w-sm space-y-1 text-left text-sm text-muted-foreground">
          <li>1. Add the Feedbeat Collector extension to Chrome, Edge or Brave.</li>
          <li>2. Sign in to X in the same browser.</li>
          <li>3. Reload this page and start the scan right here.</li>
        </ol>
      ) : IS_DEV ? (
        <ol className="mx-auto mt-4 max-w-md space-y-1 text-left text-sm text-muted-foreground">
          <li>
            1. Open <code>chrome://extensions</code>, turn on Developer mode and choose <strong>Load unpacked</strong>.
          </li>
          <li>
            2. Pick the <code>extension/</code> folder of this repo. It works on <code>localhost</code> and <code>127.0.0.1</code> at any port.
          </li>
          <li>3. Reload this page. Already loaded it? It only joins pages opened after it was loaded or reloaded.</li>
        </ol>
      ) : (
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">The extension isn&apos;t in the Chrome Web Store yet. Use your X archive in the meantime.</p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {EXTENSION_URL && (
          <Button asChild size="lg" variant="gradient">
            <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer">
              <Puzzle /> Get the extension
            </a>
          </Button>
        )}
        <Button size="lg" variant="outline" onClick={onCheckAgain}>
          <RefreshCw /> Check again
        </Button>
        {!EXTENSION_URL && !IS_DEV ? <ArchiveButton /> : null}
      </div>
      <p className="mt-5 text-xs text-muted-foreground">
        Looked for it on <code>{typeof window === "undefined" ? "this page" : window.location.origin}</code>. The extension only runs on the sites it
        lists, so an old copy that doesn&apos;t know this address won&apos;t be found even if it&apos;s installed.
      </p>
      {(EXTENSION_URL || IS_DEV) && (
        <p className="mt-3 text-sm text-muted-foreground">
          No extension? <Link href="/import" className="font-medium text-primary hover:underline">Import your X archive instead</Link>.
        </p>
      )}
    </div>
  );
}

/** The extension is on this page but couldn't help (usually: it was updated or reloaded after the page opened). */
function Broken({ problem, onCheckAgain }: { problem: string | null; onCheckAgain: () => void }) {
  return (
    <Card>
      <Alert tone="error">The Feedbeat Collector is installed but isn&apos;t answering{problem ? `: ${problem}` : "."}</Alert>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button size="lg" variant="gradient" onClick={() => window.location.reload()}>
          <RefreshCw /> Reload this page
        </Button>
        <Button size="lg" variant="outline" onClick={onCheckAgain}>
          Check again
        </Button>
      </div>
    </Card>
  );
}
