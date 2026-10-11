import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PlatformIcon } from "@/components/platform-icon";
import { PlaylistCard } from "@/components/playlist-card";
import { ProfileCard } from "@/components/profile-card";
import { StartCta } from "@/components/start-cta";
import { Skeleton } from "@/components/ui/skeleton";
import { isPlatformId, PLATFORM_IDS, PLATFORMS, type PlatformId } from "@/lib/platforms";
import { cn } from "@/lib/utils";
import { cachedNewestProfiles, cachedSearch, cachedTopProfiles, cachedTrending } from "@/server/cached";

export const metadata: Metadata = {
  title: "Explore playlists made from X timelines",
  description:
    "Browse trending Spotify, YouTube, Apple Music and SoundCloud playlists built from the music people share on X. Search any profile.",
  alternates: { canonical: "/explore" },
};

type Tab = "trending" | "top" | "new";

export default function ExplorePage({ searchParams }: PageProps<"/explore">) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="max-w-2xl">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Explore</h1>
        <p className="mt-2 text-muted-foreground">Trending playlists, the most musical accounts and fresh discoveries.</p>
      </header>
      <Suspense fallback={<ExploreSkeleton />}>
        <ExploreContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ExploreContent({ searchParams }: Pick<PageProps<"/explore">, "searchParams">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 50) : "";
  const platform = typeof sp.platform === "string" && isPlatformId(sp.platform) ? sp.platform : undefined;
  const tab: Tab = sp.tab === "top" || sp.tab === "new" ? sp.tab : "trending";

  const href = (next: Partial<{ tab: Tab; platform?: PlatformId; q: string }>) => {
    const params = new URLSearchParams();
    const t = next.tab ?? tab;
    const p = "platform" in next ? next.platform : platform;
    if (t !== "trending") params.set("tab", t);
    if (p) params.set("platform", p);
    const s = params.toString();
    return `/explore${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <form action="/explore" role="search" className="mt-8 flex max-w-xl items-center gap-2 rounded-full border border-border bg-card p-1.5 pl-4 focus-within:ring-3 focus-within:ring-ring/30">
        <Search className="size-4 text-muted-foreground" aria-hidden />
        <label htmlFor="q" className="sr-only">
          Search profiles
        </label>
        <input id="q" name="q" defaultValue={q} placeholder="Search mapped profiles…" className="h-9 flex-1 bg-transparent outline-none" />
        <button className="h-9 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground">Search</button>
      </form>

      {q ? (
        <SearchResults q={q} />
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-center gap-2" role="tablist" aria-label="Sort">
            {(
              [
                ["trending", "🔥 Trending"],
                ["top", "🏆 Top profiles"],
                ["new", "✨ New"],
              ] as const
            ).map(([t, label]) => (
              <Link
                key={t}
                href={href({ tab: t })}
                role="tab"
                aria-selected={tab === t}
                className={cn(
                  "rounded-full border border-border px-4 py-1.5 text-sm font-medium transition hover:bg-accent",
                  tab === t && "border-transparent bg-foreground text-background hover:bg-foreground",
                )}
              >
                {label}
              </Link>
            ))}
          </div>

          {tab === "trending" && (
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Filter by platform">
              <Link
                href={href({ platform: undefined })}
                className={cn("rounded-full px-3 py-1 text-sm text-muted-foreground hover:text-foreground", !platform && "bg-accent text-foreground")}
              >
                All
              </Link>
              {PLATFORM_IDS.map((p) => (
                <Link
                  key={p}
                  href={href({ platform: p })}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm text-muted-foreground hover:text-foreground",
                    platform === p && "bg-accent text-foreground",
                  )}
                >
                  <PlatformIcon platform={p} colored className="size-3.5" /> {PLATFORMS[p].name}
                </Link>
              ))}
            </div>
          )}

          <div className="mt-8">
            {tab === "trending" && <TrendingTab platform={platform} />}
            {tab === "top" && <ProfilesTab kind="top" />}
            {tab === "new" && <ProfilesTab kind="new" />}
          </div>
        </>
      )}
    </>
  );
}

async function TrendingTab({ platform }: { platform?: PlatformId }) {
  const items = await cachedTrending(24, platform);
  if (!items.length) return <Empty />;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {items.map((p, i) => (
        <PlaylistCard key={p.id} p={p} priority={i < 6} />
      ))}
    </div>
  );
}

async function ProfilesTab({ kind }: { kind: "top" | "new" }) {
  const items = kind === "top" ? await cachedTopProfiles(30) : await cachedNewestProfiles(30);
  if (!items.length) return <Empty />;
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {items.map((p) => (
        <ProfileCard key={p.id} p={p} />
      ))}
    </div>
  );
}

async function SearchResults({ q }: { q: string }) {
  const items = await cachedSearch(q);
  return (
    <section className="mt-8" aria-live="polite">
      <h2 className="text-sm text-muted-foreground">
        {items.length} result{items.length === 1 ? "" : "s"} for “{q}”
      </h2>
      {items.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <ProfileCard key={p.id} p={p} />
          ))}
        </div>
      ) : (
        <div className="mt-6 max-w-xl rounded-3xl border border-dashed border-border p-8">
          <p className="font-semibold">Not on the site yet.</p>
          <StartCta size="sm" className="mt-4" defaultHandle={q.replace(/^@/, "")} />
        </div>
      )}
    </section>
  );
}

function Empty() {
  return (
    <div className="rounded-3xl border border-dashed border-border p-12 text-center">
      <p className="font-display text-lg font-semibold">Nothing here yet</p>
      <p className="mt-1 text-sm text-muted-foreground">Import your X archive to publish the first playlists.</p>
    </div>
  );
}

function ExploreSkeleton() {
  return (
    <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: 12 }, (_, i) => (
        <Skeleton key={i} className="aspect-[4/5]" />
      ))}
    </div>
  );
}
