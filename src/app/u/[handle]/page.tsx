import { AlertTriangle, BadgeCheck, ExternalLink, Music2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import type { ProfilePage } from "schema-dts";
import { Avatar } from "@/components/avatar";
import { FollowButton } from "@/components/follow-button";
import { JsonLd } from "@/components/json-ld";
import { LevelPill } from "@/components/level-pill";
import { PlatformIcon, XIcon } from "@/components/platform-icon";
import { RefreshButton } from "@/components/refresh-button";
import { ScanForm } from "@/components/scan-form";
import { ScanStatus } from "@/components/scan-status";
import { ShareButtons } from "@/components/share-button";
import { TimeAgo } from "@/components/time-ago";
import { Skeleton } from "@/components/ui/skeleton";
import { getSession } from "@/lib/auth";
import { PLATFORMS } from "@/lib/platforms";
import { absoluteUrl, site } from "@/lib/site";
import { formatCompact, plural } from "@/lib/utils";
import { cachedProfileMeta } from "@/server/cached";
import { getProfile, getProfilePlaylists, getRecentTracks, getTopArtists, viewerFollows } from "@/server/queries";
import { canRescan, normalizeHandle } from "@/server/scan";

export async function generateMetadata({ params }: PageProps<"/u/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  const data = await cachedProfileMeta(handle);
  if (!data) {
    return { title: `@${handle}'s music`, robots: { index: false } };
  }
  const { profile, playlists } = data;
  const name = profile.name ?? `@${profile.displayHandle}`;
  const platforms = playlists.map((p) => PLATFORMS[p.platform].name);
  const description =
    profile.trackCount > 0
      ? `${plural(profile.trackCount, "song")} shared by ${name} (@${profile.displayHandle}) on X, turned into ${platforms.join(", ")} playlists. Play, follow and share on ${site.name}.`
      : `Music shared by ${name} (@${profile.displayHandle}) on X — playlists for Spotify, YouTube and more on ${site.name}.`;

  return {
    title: `${name} (@${profile.displayHandle}) — music & playlists`,
    description,
    alternates: { canonical: `/u/${profile.handle}` },
    openGraph: { type: "profile", title: `${name}'s music on ${site.name}`, description, url: `/u/${profile.handle}` },
    twitter: { title: `${name}'s music on ${site.name}`, description },
    robots: profile.status === "ready" && profile.trackCount > 0 ? undefined : { index: false, follow: true },
  };
}

export default function ProfileRoute({ params }: PageProps<"/u/[handle]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileContent params={params} />
      </Suspense>
    </div>
  );
}

async function ProfileContent({ params }: Pick<PageProps<"/u/[handle]">, "params">) {
  await connection();
  const { handle: raw } = await params;
  const handle = normalizeHandle(decodeURIComponent(raw));
  if (!handle) return <NotMapped handle={raw} />;

  const [row, session] = await Promise.all([getProfile(handle), getSession()]);
  if (!row) return <NotMapped handle={handle} />;

  const { profile, discoveredBy } = row;
  const [playlists, recent, artists, following] = await Promise.all([
    getProfilePlaylists(profile.id),
    getRecentTracks(profile.id, 10),
    getTopArtists(profile.id),
    viewerFollows(session?.user.id, profile.id),
  ]);

  const scanning = profile.status === "queued" || profile.status === "scanning";
  const canRefresh = !scanning && canRescan(profile.lastScannedAt);
  const name = profile.name ?? `@${profile.displayHandle}`;
  const url = absoluteUrl(`/u/${profile.handle}`);

  return (
    <>
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <Avatar src={profile.avatarUrl} name={profile.displayHandle} className="size-24 text-3xl ring-4 ring-background sm:size-32" />
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            <span className="truncate">{name}</span>
            {profile.verified && <BadgeCheck className="size-6 shrink-0 text-sky-500" aria-label="Verified on X" />}
          </h1>
          <a
            href={`https://x.com/${profile.displayHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <XIcon className="size-3.5" /> @{profile.displayHandle} <ExternalLink className="size-3" />
          </a>
          {profile.bio && <p className="mt-3 max-w-2xl text-pretty">{profile.bio}</p>}

          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Stat label="songs" value={profile.trackCount} />
            <Stat label="posts read" value={profile.tweetsScanned} />
            <Stat label="followers on X" value={profile.followersCount} />
            <Stat label={`followers on ${site.name}`} value={profile.followerCount} />
          </dl>

          {discoveredBy?.id && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm">
              <span aria-hidden>🧭</span> Discovered by
              {discoveredBy.username ? (
                <Link href={`/c/${discoveredBy.username}`} className="font-semibold hover:underline">
                  {discoveredBy.name}
                </Link>
              ) : (
                <span className="font-semibold">{discoveredBy.name}</span>
              )}
              <LevelPill xp={discoveredBy.xp} />
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <FollowButton profileId={profile.id} following={following} handle={profile.displayHandle} />
            <ShareButtons url={url} text={`Every song @${profile.displayHandle} has shared, as playlists 🎧`} />
            {canRefresh && <RefreshButton handle={profile.handle} label="Check for new songs" />}
          </div>
          {profile.lastScannedAt && !scanning && (
            <p className="mt-3 text-xs text-muted-foreground">
              Updated <TimeAgo date={profile.lastScannedAt} />
            </p>
          )}
        </div>
      </header>

      <div className="mt-10 space-y-12">
        {scanning && <ScanStatus handle={profile.handle} initialMessage={profile.statusMessage} />}

        {profile.status === "error" && (
          <div role="alert" className="flex flex-col items-start gap-4 rounded-3xl border border-amber-500/30 bg-amber-500/5 p-6 sm:flex-row sm:items-center">
            <AlertTriangle className="size-6 shrink-0 text-amber-500" />
            <div className="flex-1">
              <p className="font-semibold">We couldn&apos;t finish scanning @{profile.displayHandle}</p>
              <p className="text-sm text-muted-foreground">{profile.statusMessage}</p>
            </div>
            <RefreshButton handle={profile.handle} label="Try again" />
          </div>
        )}

        {playlists.length > 0 && (
          <section aria-labelledby="playlists-title">
            <h2 id="playlists-title" className="font-display text-2xl font-bold">
              Playlists
            </h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {playlists.map((p) => {
                const meta = PLATFORMS[p.platform];
                return (
                  <li key={p.id}>
                    <Link
                      href={`/u/${profile.handle}/${meta.slug}`}
                      className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-xl"
                      style={{ "--brand": meta.color } as React.CSSProperties}
                    >
                      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[var(--brand)]" />
                      <span className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                        {p.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- third-party artwork
                          <img src={p.coverUrl} alt="" loading="lazy" className="size-full object-cover" />
                        ) : (
                          <Music2 className="m-auto mt-7 size-6 text-muted-foreground" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 font-semibold">
                          <PlatformIcon platform={p.platform} colored /> {meta.name}
                        </span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          {plural(p.trackCount, "item")} · {formatCompact(p.likeCount)} likes
                        </span>
                        <span className="mt-2 block text-xs font-semibold text-primary group-hover:underline">Open playlist →</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {!scanning && profile.status === "ready" && playlists.length === 0 && (
          <div className="rounded-3xl border border-dashed border-border p-10 text-center">
            <p className="font-display text-xl font-semibold">No music links found (yet)</p>
            <p className="mt-2 text-muted-foreground">
              @{profile.displayHandle} hasn&apos;t shared Spotify, YouTube or other music links in their recent posts.
            </p>
          </div>
        )}

        {artists.length > 0 && (
          <section aria-labelledby="artists-title">
            <h2 id="artists-title" className="font-display text-2xl font-bold">
              Most shared artists
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {artists.map((a) => (
                <li key={a.artist} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm">
                  {a.artist} <span className="text-muted-foreground">×{a.n}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {recent.length > 0 && (
          <section aria-labelledby="recent-title">
            <h2 id="recent-title" className="font-display text-2xl font-bold">
              Latest finds
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {recent.map((t) => (
                <li key={t.id}>
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition hover:bg-accent/40"
                  >
                    <span className="size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {t.thumbnailUrl && (
                        // eslint-disable-next-line @next/next/no-img-element -- third-party artwork
                        <img src={t.thumbnailUrl} alt="" loading="lazy" className="size-full object-cover" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{t.title ?? "Untitled"}</span>
                      <span className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                        <PlatformIcon platform={t.platform} className="size-3.5" /> {t.artist ?? PLATFORMS[t.platform].name}
                      </span>
                    </span>
                    <TimeAgo date={t.tweetedAt} className="shrink-0 text-xs text-muted-foreground" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <JsonLd<ProfilePage>
        data={{
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          url,
          name: `${name}'s music`,
          dateModified: profile.lastScannedAt?.toISOString(),
          mainEntity: {
            "@type": "Person",
            name,
            alternateName: `@${profile.displayHandle}`,
            description: profile.bio ?? undefined,
            image: profile.avatarUrl ?? undefined,
            sameAs: [`https://x.com/${profile.displayHandle}`],
          },
          hasPart: playlists.map((p) => ({
            "@type": "MusicPlaylist",
            name: `@${profile.displayHandle} on ${PLATFORMS[p.platform].name}`,
            numTracks: p.trackCount,
            url: absoluteUrl(`/u/${profile.handle}/${p.platform}`),
          })),
        }}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="sr-only">{label}</dt>
      <dd className="font-semibold tabular-nums">{formatCompact(value)}</dd>
      <span aria-hidden className="text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function NotMapped({ handle }: { handle: string }) {
  return (
    <div className="mx-auto max-w-xl py-12 text-center">
      <p className="text-5xl" aria-hidden>
        🎧
      </p>
      <h1 className="mt-4 font-display text-3xl font-bold">@{handle} hasn&apos;t been mapped yet</h1>
      <p className="mt-2 text-muted-foreground">Be the first to discover their music — and earn the Pioneer credit.</p>
      <ScanForm size="sm" className="mt-8" defaultHandle={handle} />
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading profile">
      <div className="flex flex-col gap-6 sm:flex-row">
        <Skeleton className="size-24 rounded-full sm:size-32" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-full max-w-lg" />
          <Skeleton className="h-10 w-72" />
        </div>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    </div>
  );
}
