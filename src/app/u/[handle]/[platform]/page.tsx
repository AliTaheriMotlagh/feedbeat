import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import type { BreadcrumbList, MusicPlaylist } from "schema-dts";
import { Avatar } from "@/components/avatar";
import { Comments } from "@/components/comments";
import { SpotifyExportButton, YouTubeQueueButton } from "@/components/export-buttons";
import { JsonLd } from "@/components/json-ld";
import { LikeButton } from "@/components/like-button";
import { PlatformIcon } from "@/components/platform-icon";
import { Player, type PlayerTrack } from "@/components/player";
import { PlaylistCard } from "@/components/playlist-card";
import { ShareButtons } from "@/components/share-button";
import { Skeleton } from "@/components/ui/skeleton";
import { features } from "@/env";
import { getSession } from "@/lib/auth";
import { isPlatformId, PLATFORMS, type PlatformId } from "@/lib/platforms";
import { absoluteUrl, site } from "@/lib/site";
import { formatCompact, plural } from "@/lib/utils";
import { cachedPlaylistMeta, cachedRelated } from "@/server/cached";
import { getComments, getPlaylist, viewerLikes } from "@/server/queries";

export async function generateMetadata({ params }: PageProps<"/u/[handle]/[platform]">): Promise<Metadata> {
  const { handle, platform } = await params;
  if (!isPlatformId(platform)) return { title: "Playlist not found", robots: { index: false } };
  const data = await cachedPlaylistMeta(handle, platform);
  if (!data) return { title: "Playlist not found", robots: { index: false } };

  const { profile, playlist, tracks } = data;
  const name = profile.name ?? `@${profile.displayHandle}`;
  const pName = PLATFORMS[platform].name;
  const sample = tracks
    .slice(0, 3)
    .map((t) => [t.title, t.artist].filter(Boolean).join(" – "))
    .filter(Boolean)
    .join(", ");
  const title = `${name}'s ${pName} playlist (${plural(playlist.trackCount, "song")})`;
  const description = `Every ${pName} link @${profile.displayHandle} shared on X, in one playlist${sample ? `: ${sample} and more` : ""}. Listen free on ${site.name}.`;

  return {
    title,
    description,
    alternates: { canonical: `/u/${profile.handle}/${platform}` },
    openGraph: { type: "music.playlist", title, description, url: `/u/${profile.handle}/${platform}` },
    twitter: { title, description },
    robots: playlist.trackCount > 0 ? undefined : { index: false },
  };
}

export default function PlaylistRoute({ params }: PageProps<"/u/[handle]/[platform]">) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Suspense fallback={<PlaylistSkeleton />}>
        <PlaylistContent params={params} />
      </Suspense>
    </div>
  );
}

async function PlaylistContent({ params }: Pick<PageProps<"/u/[handle]/[platform]">, "params">) {
  await connection();
  const { handle, platform } = await params;
  if (!isPlatformId(platform)) notFound();

  const [data, session] = await Promise.all([getPlaylist(handle, platform), getSession()]);
  if (!data) notFound();
  const { playlist, profile, tracks } = data;

  const [liked, comments] = await Promise.all([viewerLikes(session?.user.id, playlist.id), getComments(playlist.id)]);

  const meta = PLATFORMS[platform];
  const name = profile.name ?? `@${profile.displayHandle}`;
  const url = absoluteUrl(`/u/${profile.handle}/${platform}`);
  const playerTracks: PlayerTrack[] = tracks.map((t) => ({
    id: t.id,
    platform: t.platform,
    kind: t.kind,
    externalId: t.externalId,
    url: t.url,
    title: t.title,
    artist: t.artist,
    thumbnailUrl: t.thumbnailUrl,
    tweetId: t.tweetId,
    tweetText: t.tweetText,
    tweetedAt: t.tweetedAt.toISOString(),
  }));
  const videoIds = platform === "youtube" ? tracks.filter((t) => t.kind === "video").map((t) => t.externalId) : [];

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link href={`/u/${profile.handle}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" /> All of @{profile.displayHandle}&apos;s playlists
        </Link>
      </nav>

      <header
        className="relative isolate mb-8 overflow-hidden rounded-3xl border border-border p-6 sm:p-8"
        style={{ "--brand": meta.color } as React.CSSProperties}
      >
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,color-mix(in_oklch,var(--brand)_25%,transparent),transparent_60%)]" />
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
          <div className="relative size-36 shrink-0 overflow-hidden rounded-2xl bg-muted shadow-2xl sm:size-44">
            {playlist.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- third-party artwork
              <img src={playlist.coverUrl} alt="" className="size-full object-cover" />
            )}
            <span className="absolute bottom-2 left-2 rounded-full bg-black/70 p-1.5 backdrop-blur">
              <PlatformIcon platform={platform} colored className="size-5" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: meta.color === "#00FFFF" ? undefined : meta.color }}>
              {meta.name} playlist
            </p>
            <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-balance sm:text-5xl">{name}&apos;s {meta.name} finds</h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <Link href={`/u/${profile.handle}`} className="inline-flex items-center gap-2 font-semibold text-foreground hover:underline">
                <Avatar src={profile.avatarUrl} name={profile.displayHandle} className="size-6 text-[10px]" />@{profile.displayHandle}
              </Link>
              <span aria-hidden>·</span>
              {plural(playlist.trackCount, "item")}
              <span aria-hidden>·</span>
              {formatCompact(playlist.playCount)} plays
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <LikeButton playlistId={playlist.id} liked={liked} count={playlist.likeCount} />
              <ShareButtons url={url} text={`Listening to @${profile.displayHandle}'s ${meta.name} finds 🎧`} playlistId={playlist.id} />
              {platform === "spotify" && features.spotifyExport && <SpotifyExportButton playlistId={playlist.id} />}
              {platform === "youtube" && <YouTubeQueueButton videoIds={videoIds} />}
            </div>
          </div>
        </div>
      </header>

      <Player tracks={playerTracks} playlistId={playlist.id} handle={profile.displayHandle} />

      <div className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Comments
          playlistId={playlist.id}
          initial={comments.map((c) => ({ ...c, author: { ...c.author, username: c.author.username ?? null } }))}
        />
        <Suspense fallback={<Skeleton className="h-64" />}>
          <Related platform={platform} excludeId={playlist.id} />
        </Suspense>
      </div>

      <JsonLd<MusicPlaylist>
        data={{
          "@context": "https://schema.org",
          "@type": "MusicPlaylist",
          name: `${name}'s ${meta.name} playlist`,
          url,
          numTracks: playlist.trackCount,
          image: playlist.coverUrl ?? undefined,
          creator: { "@type": "Person", name, sameAs: `https://x.com/${profile.displayHandle}` },
          track: tracks.slice(0, 50).map((t) => ({
            "@type": "MusicRecording",
            name: t.title ?? undefined,
            byArtist: t.artist ? { "@type": "MusicGroup", name: t.artist } : undefined,
            url: t.url,
          })),
          interactionStatistic: {
            "@type": "InteractionCounter",
            interactionType: { "@type": "LikeAction" },
            userInteractionCount: playlist.likeCount,
          },
        }}
      />
      <JsonLd<BreadcrumbList>
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: site.name, item: site.url },
            { "@type": "ListItem", position: 2, name: `@${profile.displayHandle}`, item: absoluteUrl(`/u/${profile.handle}`) },
            { "@type": "ListItem", position: 3, name: meta.name, item: url },
          ],
        }}
      />
    </>
  );
}

async function Related({ platform, excludeId }: { platform: PlatformId; excludeId: string }) {
  const items = await cachedRelated(platform, excludeId);
  if (!items.length) return null;
  return (
    <aside aria-labelledby="related-title">
      <h2 id="related-title" className="font-display text-xl font-bold">
        More {PLATFORMS[platform].name} playlists
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {items.slice(0, 4).map((p) => (
          <PlaylistCard key={p.id} p={p} />
        ))}
      </div>
    </aside>
  );
}

function PlaylistSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading playlist">
      <Skeleton className="mb-8 h-64 rounded-3xl" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
        <Skeleton className="aspect-video" />
      </div>
    </div>
  );
}
