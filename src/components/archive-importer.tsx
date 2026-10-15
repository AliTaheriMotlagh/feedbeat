"use client";

import { CheckCircle2, FileArchive, Link2, Loader2, Lock, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useSession } from "@/lib/auth-client";
import { normalizeArchiveUrl } from "@/lib/archive-url";
import { PLATFORMS, type PlatformId } from "@/lib/platforms";
import { openRemoteZip } from "@/lib/remote-zip";
import { cn } from "@/lib/utils";
import {
  extractAccount,
  extractMusicLinks,
  extractProfile,
  isNeededArchiveFile,
  parseYtdFile,
  type ArchiveAccount,
  type ArchiveProfile,
  type ArchiveScan,
} from "@/lib/x-archive";
import { listZipEntries, readZipEntryText, type ZipSource } from "@/lib/zip-reader";
import { useAuthPrompt } from "./auth-prompt";
import { Avatar } from "./avatar";
import { PlatformIcon } from "./platform-icon";

const CHUNK = 100;

type State =
  | { step: "idle" }
  | { step: "reading"; message: string }
  | { step: "ready"; account: ArchiveAccount; profile: ArchiveProfile; scan: ArchiveScan }
  | { step: "uploading"; account: ArchiveAccount; done: number; total: number }
  | { step: "error"; message: string };

type ArchiveText = { kind: "tweets" | "account" | "profile"; text: string };

const tick = () => new Promise((r) => setTimeout(r, 0));
const mb = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;

/** Collect the text of the tweets/account/profile data files inside a zip. */
async function readZip(zip: Blob | ZipSource, texts: ArchiveText[], onProgress: (m: string) => void) {
  if (typeof DecompressionStream === "undefined") throw new Error("Your browser is too old to open zip files. Unzip the archive and drop the data/*.js files instead.");
  const entries = await listZipEntries(zip);
  for (const entry of entries) {
    const kind = isNeededArchiveFile(entry.name);
    if (!kind) continue;
    onProgress(`Reading ${entry.name}…`);
    texts.push({ kind, text: await readZipEntryText(zip, entry) });
    await tick();
  }
}

/** From a dropped .zip or loose .js files. */
async function readFiles(files: File[], onProgress: (m: string) => void) {
  const texts: ArchiveText[] = [];
  for (const file of files) {
    if (/\.zip$/i.test(file.name)) {
      onProgress(`Opening ${file.name}…`);
      await readZip(file, texts, onProgress);
    } else {
      const kind = isNeededArchiveFile(file.name);
      if (kind) texts.push({ kind, text: await file.text() });
    }
  }
  return texts;
}

/** From a link, downloading only the zip directory and the data files we need. */
async function readLink(url: string, onProgress: (m: string) => void) {
  let label = "Opening link…";
  let loaded = 0;
  const report = () => onProgress(loaded ? `${label} · ${mb(loaded)} downloaded` : label);
  report();
  const zip = await openRemoteZip(url, (n) => {
    loaded = n;
    report();
  });
  label = `Opening ${mb(zip.size)} archive…`;
  report();
  const texts: ArchiveText[] = [];
  await readZip(zip, texts, (m) => {
    label = m;
    report();
  });
  return texts;
}

export function ArchiveImporter() {
  const [state, setState] = useState<State>({ step: "idle" });
  const [dragging, setDragging] = useState(false);
  const [link, setLink] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: session } = useSession();
  const prompt = useAuthPrompt();
  const router = useRouter();

  async function handleFiles(list: FileList | null) {
    const files = [...(list ?? [])];
    if (files.length) await load((onProgress) => readFiles(files, onProgress));
  }

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    let url: string;
    try {
      url = normalizeArchiveUrl(link);
    } catch (err) {
      return setState({ step: "error", message: err instanceof Error ? err.message : "Invalid link." });
    }
    if (!session) return prompt("Sign in to import from a link. We fetch only your posts — not your media — and read them in your browser.");
    await load((onProgress) => readLink(url, onProgress));
  }

  async function load(read: (onProgress: (m: string) => void) => Promise<ArchiveText[]>) {
    try {
      setState({ step: "reading", message: "Reading your archive…" });
      const texts = await read((message) => setState({ step: "reading", message }));

      const accountText = texts.find((t) => t.kind === "account");
      const tweetTexts = texts.filter((t) => t.kind === "tweets");
      if (!accountText || !tweetTexts.length) {
        throw new Error("We couldn't find data/tweets.js and data/account.js. Drop the original .zip from X, or those files.");
      }
      const account = extractAccount(parseYtdFile(accountText.text));
      if (!account) throw new Error("account.js is missing your username.");
      const profileText = texts.find((t) => t.kind === "profile");
      const profile = profileText ? extractProfile(parseYtdFile(profileText.text)) : { bio: null, avatarUrl: null };

      setState({ step: "reading", message: "Finding music links…" });
      await tick();
      const scan = extractMusicLinks(tweetTexts.flatMap((t) => parseYtdFile(t.text)));
      setState({ step: "ready", account, profile, scan });
    } catch (err) {
      setState({ step: "error", message: err instanceof Error ? err.message : "Couldn't read that file." });
    }
  }

  async function publish(account: ArchiveAccount, profile: ArchiveProfile, scan: ArchiveScan) {
    if (!session) return prompt("Sign in to publish your playlists and earn XP.");

    const post = async (body: unknown) => {
      const res = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      return data;
    };

    try {
      setState({ step: "uploading", account, done: 0, total: scan.items.length });
      const { profileId } = (await post({ phase: "start", account, profile, tweetsScanned: scan.tweetsScanned })) as { profileId: string };
      for (let i = 0; i < scan.items.length; i += CHUNK) {
        await post({ phase: "chunk", profileId, items: scan.items.slice(i, i + CHUNK) });
        setState({ step: "uploading", account, done: Math.min(i + CHUNK, scan.items.length), total: scan.items.length });
      }
      const { handle, total } = (await post({ phase: "finish", profileId })) as { handle: string; total: number };
      toast.success(`Published ${total} songs 🎉`);
      router.push(`/u/${handle}`);
    } catch (err) {
      setState({ step: "error", message: err instanceof Error ? err.message : "Upload failed." });
    }
  }

  if (state.step === "ready") {
    const { account, profile, scan } = state;
    const found = scan.items.length;
    return (
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <Avatar src={profile.avatarUrl} name={account.username} className="size-14" />
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-bold">{account.displayName ?? account.username}</p>
            <p className="text-sm text-muted-foreground">
              @{account.username} · {scan.tweetsScanned.toLocaleString("en-US")} posts read on your device
            </p>
          </div>
        </div>

        {found === 0 ? (
          <p className="mt-6 rounded-2xl bg-muted p-5 text-center">No music links found in this archive.</p>
        ) : (
          <>
            <p className="mt-6 font-display text-3xl font-extrabold">
              {found.toLocaleString("en-US")} <span className="text-gradient">songs found</span>
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {(Object.entries(scan.byPlatform) as [PlatformId, number][]).map(([p, n]) => (
                <li key={p} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm">
                  <PlatformIcon platform={p} colored /> {PLATFORMS[p].name} <span className="font-semibold">{n}</span>
                </li>
              ))}
              {scan.unresolved > 0 && (
                <li className="rounded-full border border-dashed border-border px-3 py-1 text-sm text-muted-foreground">
                  +{scan.unresolved} short links to check
                </li>
              )}
            </ul>
            <p className="mt-5 flex items-start gap-2 text-sm text-muted-foreground">
              <Lock className="mt-0.5 size-4 shrink-0" />
              Only these music links (with post date and text) will be uploaded. Your archive, DMs, e-mail and everything else stay on your
              device.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button size="lg" variant="gradient" onClick={() => publish(account, profile, scan)}>
                <UploadCloud /> {session ? "Publish my playlists" : "Sign in & publish"}
              </Button>
              <Button size="lg" variant="ghost" onClick={() => setState({ step: "idle" })}>
                Choose another file
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (state.step === "uploading") {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center" aria-live="polite">
        <Loader2 className="mx-auto size-8 animate-spin text-primary" />
        <p className="mt-4 font-display text-xl font-bold">Building @{state.account.username}&apos;s playlists…</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {state.done} / {state.total} songs · fetching titles & artwork
        </p>
        <Progress value={state.total ? state.done / state.total : 1} className="mx-auto mt-6 max-w-sm" label="Upload progress" />
        <p className="mt-4 text-xs text-muted-foreground">Keep this tab open until it finishes.</p>
      </div>
    );
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Choose your X archive"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center rounded-3xl border-2 border-dashed border-border bg-card/60 px-6 py-14 text-center transition hover:border-primary/60 hover:bg-accent/30",
          dragging && "border-primary bg-accent/40",
        )}
      >
        {state.step === "reading" ? (
          <>
            <Loader2 className="size-10 animate-spin text-primary" />
            <p className="mt-4 font-semibold">{state.message}</p>
            <p className="text-sm text-muted-foreground">Everything happens in your browser.</p>
          </>
        ) : (
          <>
            <FileArchive className="size-10 text-primary" />
            <p className="mt-4 font-display text-xl font-bold">Drop your X archive (.zip) here</p>
            <p className="mt-1 text-sm text-muted-foreground">or click to choose · you can also drop data/tweets.js + data/account.js</p>
            <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3.5 text-emerald-500" /> Processed locally — nothing is uploaded until you say so
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".zip,.js,application/zip"
          multiple
          className="sr-only"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      <form onSubmit={handleLink} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="archive-link" className="sr-only">
          Link to your X archive .zip
        </label>
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="archive-link"
            type="url"
            inputMode="url"
            placeholder="…or paste a link to the .zip (Dropbox, Google Drive, direct URL)"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            disabled={state.step === "reading"}
            className="h-11 pl-10"
          />
        </div>
        <Button type="submit" size="lg" variant="outline" disabled={!link.trim() || state.step === "reading"}>
          Import from link
        </Button>
      </form>
      <p className="mt-2 text-xs text-muted-foreground">
        The link must be public (e.g. Google Drive “Anyone with the link”). We download only the zip index and your posts/account files —
        never your media — and read them in your browser. Nothing is stored.
      </p>
      {state.step === "error" && (
        <p role="alert" className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {state.message}
        </p>
      )}
    </div>
  );
}
