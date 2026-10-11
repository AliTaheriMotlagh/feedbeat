import { ArrowRight, Flame, Heart, Medal, Radar, Share2, Sparkles, Trophy, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { FAQPage } from "schema-dts";
import { Suspense } from "react";
import { ActivityFeed } from "@/components/activity-feed";
import { Avatar } from "@/components/avatar";
import { JsonLd } from "@/components/json-ld";
import { PlatformIcon } from "@/components/platform-icon";
import { PlaylistCard } from "@/components/playlist-card";
import { ProfileCard } from "@/components/profile-card";
import { StartCta } from "@/components/start-cta";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BADGES } from "@/lib/gamification";
import { PLATFORM_IDS, PLATFORMS } from "@/lib/platforms";
import { site } from "@/lib/site";
import { formatCompact } from "@/lib/utils";
import { cachedLeaderboard, cachedSiteStats, cachedTopProfiles, cachedTrending } from "@/server/cached";
import { FAQ, FAQ_ITEMS } from "./faq";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <PlatformStrip />
      <HowItWorks />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-labelledby="trending-title">
        <SectionHeading id="trending-title" eyebrow="Trending this week" title="Playlists people can't stop playing" href="/explore" />
        <Suspense fallback={<CardGridSkeleton />}>
          <TrendingGrid />
        </Suspense>
      </section>
      <Gamification />
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2" aria-label="Community">
        <div>
          <SectionHeading eyebrow="Most musical accounts" title="Top profiles" href="/explore?tab=top" />
          <Suspense fallback={<ListSkeleton />}>
            <TopProfiles />
          </Suspense>
        </div>
        <div>
          <SectionHeading eyebrow="Live" title="Happening now" href="/feed" />
          <Suspense fallback={<ListSkeleton />}>
            <ActivityFeed limit={8} />
          </Suspense>
        </div>
      </section>
      <FAQ />
      <FinalCta />
      <JsonLd<FAQPage>
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ_ITEMS.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }}
      />
    </>
  );
}

/* ----------------------------------- Hero ---------------------------------- */

function Hero() {
  return (
    <section id="scan" className="relative isolate scroll-mt-20 overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10 bg-grid opacity-60" />
      <div
        aria-hidden
        className="absolute top-[-20%] left-1/2 -z-10 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--glow),transparent)] blur-3xl"
      />
      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24">
        <Link
          href="/leaderboard"
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur transition hover:text-foreground"
        >
          <Sparkles className="size-3.5 text-primary" />
          Publish a profile first, earn +50 XP
          <ArrowRight className="size-3" />
        </Link>
        <h1 className="font-display text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-6xl md:text-7xl">
          Every song they ever posted, <span className="text-gradient">one playlist away.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-pretty text-muted-foreground sm:text-xl">
          {site.name} reads X posts, finds every Spotify, YouTube, Apple Music & SoundCloud link, and builds a playlist for each
          platform — ready to play, follow and share.
        </p>
        <StartCta className="mt-10 max-w-xl" />
        <Suspense fallback={<StatsRow />}>
          <LiveStats />
        </Suspense>
      </div>
    </section>
  );
}

async function LiveStats() {
  const stats = await cachedSiteStats();
  return <StatsRow stats={stats} />;
}

function StatsRow({ stats }: { stats?: { profiles: number; tracks: number; curators: number } }) {
  const items = [
    { label: "profiles mapped", value: stats?.profiles },
    { label: "songs found", value: stats?.tracks },
    { label: "curators", value: stats?.curators },
  ];
  return (
    <dl className="mt-10 grid w-full max-w-lg grid-cols-3 gap-4">
      {items.map((i) => (
        <div key={i.label}>
          <dt className="text-xs text-muted-foreground">{i.label}</dt>
          <dd className="font-display text-2xl font-bold tabular-nums sm:text-3xl">{i.value === undefined ? "—" : formatCompact(i.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function PlatformStrip() {
  return (
    <section aria-label="Supported platforms" className="border-y border-border bg-card/40">
      <ul className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-4 py-6">
        {PLATFORM_IDS.map((p) => (
          <li key={p} className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <PlatformIcon platform={p} colored className="size-5" />
            {PLATFORMS[p].name}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------- How it works ------------------------------ */

function HowItWorks() {
  const steps = [
    { icon: Radar, title: "Bring your posts", body: "Drop your free X archive (or a handle, where enabled). Your archive is read right in your browser." },
    { icon: Sparkles, title: "We find the music", body: "Every Spotify, YouTube, Apple Music & SoundCloud link becomes a track, album or video." },
    { icon: Share2, title: "Play, follow & share", body: "Get one playlist per platform. Save it to Spotify, queue it on YouTube, share it anywhere." },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6" aria-labelledby="how-title">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold text-primary">How it works</p>
        <h2 id="how-title" className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          From timeline to tracklist in seconds
        </h2>
      </div>
      <ol className="mt-12 grid gap-6 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="relative rounded-3xl border border-border bg-card p-6">
            <span className="absolute top-6 right-6 font-display text-5xl font-extrabold text-muted/80">{i + 1}</span>
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <s.icon className="size-5" />
            </span>
            <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
            <p className="mt-2 text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------- Gamification ------------------------------ */

function Gamification() {
  const perks = [
    { icon: Radar, title: "Publish first", body: "Bring a profile to the site first and it's credited to you forever. +50 XP." },
    { icon: Heart, title: "Earn from taste", body: "Every like on a playlist you discovered pays you +5 XP." },
    { icon: Flame, title: "Keep the streak", body: "Show up daily for bonus XP. 7 days unlocks On Fire 🔥." },
    { icon: Medal, title: "Collect badges", body: "Pioneer, Goldmine, Tastemaker… there's one for every kind of digger." },
  ];
  const badges = Object.values(BADGES).slice(0, 8);
  return (
    <section className="relative isolate overflow-hidden border-y border-border bg-card/40 py-20" aria-labelledby="game-title">
      <div aria-hidden className="absolute -right-40 -bottom-40 -z-10 size-[500px] rounded-full bg-[radial-gradient(closest-side,var(--glow),transparent)] blur-2xl" />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-sm font-semibold text-primary">Social, but about music</p>
          <h2 id="game-title" className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Dig. Discover. Climb the leaderboard.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Every scan, like and comment earns XP. Level up from <em>Listener</em> to <em>Legend</em> and show off your badges.
          </p>
          <dl className="mt-8 grid gap-6 sm:grid-cols-2">
            {perks.map((p) => (
              <div key={p.title}>
                <dt className="flex items-center gap-2 font-semibold">
                  <p.icon className="size-4 text-primary" /> {p.title}
                </dt>
                <dd className="mt-1 text-sm text-muted-foreground">{p.body}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-8 flex flex-wrap gap-2">
            {badges.map((b) => (
              <span key={b.id} title={b.description} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-sm">
                <span aria-hidden>{b.emoji}</span> {b.name}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-border bg-background p-6 shadow-2xl shadow-violet-500/10">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold">
              <Trophy className="size-4 text-amber-500" /> This week&apos;s top curators
            </h3>
            <Link href="/leaderboard" className="text-sm text-primary hover:underline">
              Full board
            </Link>
          </div>
          <Suspense fallback={<ListSkeleton rows={5} />}>
            <MiniLeaderboard />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

async function MiniLeaderboard() {
  const rows = (await cachedLeaderboard("week")).slice(0, 5);
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <Users className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 font-medium">The board is wide open.</p>
        <p className="text-sm text-muted-foreground">Publish a profile now and take the #1 spot.</p>
      </div>
    );
  }
  return (
    <ol className="space-y-2">
      {rows.map((r, i) => (
        <li key={r.id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-accent/50">
          <span className="w-6 text-center font-display font-bold text-muted-foreground">{["🥇", "🥈", "🥉"][i] ?? i + 1}</span>
          <Avatar src={r.image} name={r.name} className="size-9" />
          {r.username ? (
            <Link href={`/c/${r.username}`} className="flex-1 truncate font-medium hover:underline">
              {r.name}
            </Link>
          ) : (
            <span className="flex-1 truncate font-medium">{r.name}</span>
          )}
          <span className="font-semibold tabular-nums">{formatCompact(r.score)} XP</span>
        </li>
      ))}
    </ol>
  );
}

/* --------------------------------- Sections -------------------------------- */

async function TrendingGrid() {
  const items = await cachedTrending(8);
  if (!items.length) return <EmptyState />;
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {items.map((p, i) => (
        <PlaylistCard key={p.id} p={p} priority={i < 4} />
      ))}
    </div>
  );
}

async function TopProfiles() {
  const items = await cachedTopProfiles(6);
  if (!items.length) return <EmptyState compact />;
  return (
    <div className="space-y-3">
      {items.map((p) => (
        <ProfileCard key={p.id} p={p} />
      ))}
    </div>
  );
}

function SectionHeading({ id, eyebrow, title, href }: { id?: string; eyebrow: string; title: string; href?: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-primary">{eyebrow}</p>
        <h2 id={id} className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h2>
      </div>
      {href && (
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          See all <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}

function EmptyState({ compact }: { compact?: boolean }) {
  return (
    <div className={`rounded-3xl border border-dashed border-border text-center ${compact ? "p-8" : "p-14"}`}>
      <p className="font-display text-lg font-semibold">Nothing here yet — be the pioneer.</p>
      <p className="mt-1 text-sm text-muted-foreground">Import your X archive and your playlists will show up right here.</p>
    </div>
  );
}

function CardGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />
      ))}
    </div>
  );
}

function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 rounded-2xl" />
      ))}
    </div>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <div className="relative isolate overflow-hidden rounded-[2rem] bg-linear-to-br from-fuchsia-600 via-violet-600 to-cyan-500 px-6 py-14 text-center text-white sm:px-16">
        <div aria-hidden className="absolute inset-0 -z-10 bg-grid opacity-20" />
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">Whose taste are you curious about?</h2>
        <p className="mx-auto mt-3 max-w-xl text-white/80">Your favorite artist. A friend with impeccable taste. Yourself, five years ago.</p>
        <div className="mt-8 flex justify-center">
          <Button size="lg" className="bg-white text-violet-700 hover:bg-white/90" asChild>
            <a href="#scan">
              Make my first playlist <ArrowRight />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
