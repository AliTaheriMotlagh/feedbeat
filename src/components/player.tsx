"use client";

import { ExternalLink, Pause, Play, Shuffle } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { embedHeight, embedUrl, PLATFORMS, type MediaKind, type PlatformId } from "@/lib/platforms";
import { cn } from "@/lib/utils";
import { recordPlay } from "@/server/actions";
import { PlatformIcon } from "./platform-icon";
import { TimeAgo } from "./time-ago";

export interface PlayerTrack {
  id: string;
  platform: PlatformId;
  kind: string;
  externalId: string;
  url: string;
  title: string | null;
  artist: string | null;
  thumbnailUrl: string | null;
  tweetId: string;
  tweetText: string | null;
  tweetedAt: string;
}

/**
 * Track list + facade player: the third-party iframe only loads after the
 * visitor presses play (fast LCP, no cookies until interaction).
 */
export function Player({ tracks, playlistId, handle }: { tracks: PlayerTrack[]; playlistId: string; handle: string }) {
  const [current, setCurrent] = useState<number | null>(null);
  const [counted, setCounted] = useState(false);
  const { resolvedTheme } = useTheme();
  const track = current === null ? null : tracks[current];

  function play(i: number) {
    setCurrent(i);
    if (!counted) {
      setCounted(true);
      void recordPlay(playlistId);
    }
  }

  const src = track ? embedUrl({ ...track, kind: track.kind as MediaKind }, { dark: resolvedTheme === "dark" }) : null;
  const height = track ? embedHeight({ platform: track.platform, kind: track.kind as MediaKind }) : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <section aria-label="Tracks" className="order-2 lg:order-1">
        <div className="mb-3 flex items-center gap-2">
          <Button onClick={() => play(0)} disabled={!tracks.length}>
            <Play className="fill-current" /> Play
          </Button>
          <Button variant="outline" onClick={() => play(Math.floor(Math.random() * tracks.length))} disabled={!tracks.length}>
            <Shuffle /> Shuffle
          </Button>
        </div>
        <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {tracks.map((t, i) => {
            const active = i === current;
            return (
              <li key={t.id} className={cn("group flex items-center gap-3 p-3 transition-colors hover:bg-accent/50", active && "bg-accent")}>
                <span className="w-6 text-right text-sm text-muted-foreground tabular-nums">{i + 1}</span>
                <button
                  type="button"
                  onClick={() => play(i)}
                  className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted"
                  aria-label={`Play ${t.title ?? "track"}`}
                >
                  {t.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- third-party artwork
                    <img src={t.thumbnailUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                  ) : (
                    <PlatformIcon platform={t.platform} className="m-auto size-5 text-muted-foreground" />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100">
                    {active ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
                  </span>
                </button>
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => play(i)} className="block max-w-full truncate text-left font-medium hover:underline">
                    {t.title ?? t.url.replace(/^https?:\/\/(www\.)?/, "")}
                  </button>
                  <p className="truncate text-sm text-muted-foreground">
                    {t.artist ?? PLATFORMS[t.platform].name}
                    {t.kind !== "track" && t.kind !== "video" && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">{t.kind}</span>}
                  </p>
                </div>
                <a
                  href={`https://x.com/${handle}/status/${t.tweetId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden text-xs whitespace-nowrap text-muted-foreground hover:text-foreground sm:block"
                  title={t.tweetText ?? undefined}
                >
                  <TimeAgo date={t.tweetedAt} />
                </a>
                <a
                  href={t.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open on ${PLATFORMS[t.platform].name}`}
                  className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <ExternalLink className="size-4" />
                </a>
              </li>
            );
          })}
        </ol>
      </section>

      <aside className="order-1 lg:sticky lg:top-20 lg:order-2" aria-label="Now playing">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {track && src ? (
            <iframe
              key={track.id}
              src={src}
              title={`${track.title ?? "Track"} on ${PLATFORMS[track.platform].name}`}
              className={cn("w-full border-0", track.platform === "youtube" && "aspect-video")}
              style={height ? { height } : undefined}
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : track ? (
            <a href={track.url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-3 p-8 text-center">
              <PlatformIcon platform={track.platform} colored className="size-10" />
              <span className="font-medium">Listen on {PLATFORMS[track.platform].name}</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={() => play(0)}
              disabled={!tracks.length}
              className="group relative flex aspect-video w-full items-center justify-center bg-linear-to-br from-violet-600/30 via-fuchsia-500/20 to-cyan-500/30"
            >
              {tracks[0]?.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- third-party artwork
                <img src={tracks[0].thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover opacity-40 blur-sm" />
              )}
              <span className="relative flex size-16 items-center justify-center rounded-full bg-white text-black shadow-2xl transition-transform group-hover:scale-110">
                <Play className="ml-1 size-7 fill-current" />
              </span>
              <span className="sr-only">Play first track</span>
            </button>
          )}
          {track && (
            <div className="border-t border-border p-4">
              <p className="truncate font-semibold">{track.title ?? "Untitled"}</p>
              {track.tweetText && (
                <blockquote className="mt-2 line-clamp-3 border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground">
                  {track.tweetText}
                </blockquote>
              )}
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" disabled={current === 0} onClick={() => play((current ?? 1) - 1)}>
                  Previous
                </Button>
                <Button size="sm" variant="outline" disabled={current === tracks.length - 1} onClick={() => play((current ?? -1) + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
