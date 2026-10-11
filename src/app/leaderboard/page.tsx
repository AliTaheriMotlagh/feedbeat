import { Flame } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { LevelPill } from "@/components/level-pill";
import { Skeleton } from "@/components/ui/skeleton";
import { BADGES, XP } from "@/lib/gamification";
import { cn, formatCompact } from "@/lib/utils";
import { cachedLeaderboard, cachedTopDiscoverers } from "@/server/cached";

export const metadata: Metadata = {
  title: "Leaderboard — top music curators",
  description: "The curators discovering the best music on X this week. Earn XP by discovering profiles, collecting likes and keeping your streak.",
  alternates: { canonical: "/leaderboard" },
};

export default function LeaderboardPage({ searchParams }: PageProps<"/leaderboard">) {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Leaderboard</h1>
        <p className="mt-2 text-muted-foreground">Who&apos;s digging up the best music right now.</p>
        <Suspense fallback={<BoardSkeleton />}>
          <Board searchParams={searchParams} />
        </Suspense>
      </div>
      <aside className="space-y-8">
        <section className="rounded-3xl border border-border bg-card p-5">
          <h2 className="font-semibold">Top discoverers</h2>
          <Suspense fallback={<Skeleton className="mt-4 h-40" />}>
            <Discoverers />
          </Suspense>
        </section>
        <section className="rounded-3xl border border-border bg-card p-5">
          <h2 className="font-semibold">How to earn XP</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {[
              ["Publish a new profile", `+${XP.discover} (+1/song, up to ${XP.discoverTrackCap})`],
              ["Your discovery gets a like", `+${XP.likeReceived}`],
              ["Daily visit", `+${XP.dailyVisit}`],
              ["Share a playlist", `+${XP.share}`],
              ["Comment on a playlist", `+${XP.comment}`],
              ["Like a playlist", `+${XP.like}`],
            ].map(([k, v]) => (
              <li key={k} className="flex justify-between gap-4">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-semibold whitespace-nowrap text-primary">{v}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-3xl border border-border bg-card p-5">
          <h2 className="font-semibold">Badges</h2>
          <ul className="mt-3 space-y-3">
            {Object.values(BADGES).map((b) => (
              <li key={b.id} className="flex items-start gap-3 text-sm">
                <span className="text-xl" aria-hidden>
                  {b.emoji}
                </span>
                <span>
                  <span className="font-semibold">{b.name}</span>
                  <span className="block text-muted-foreground">{b.description}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}

async function Board({ searchParams }: Pick<PageProps<"/leaderboard">, "searchParams">) {
  const { period: raw } = await searchParams;
  const period = raw === "all" ? "all" : "week";
  const rows = await cachedLeaderboard(period);

  return (
    <>
      <div className="mt-6 inline-flex rounded-full border border-border p-1" role="tablist" aria-label="Period">
        {(
          [
            ["week", "This week"],
            ["all", "All time"],
          ] as const
        ).map(([p, label]) => (
          <Link
            key={p}
            role="tab"
            aria-selected={period === p}
            href={p === "week" ? "/leaderboard" : "/leaderboard?period=all"}
            className={cn("rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground", period === p && "bg-foreground text-background")}
          >
            {label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-border p-12 text-center">
          <p className="font-display text-xl font-semibold">No one&apos;s on the board yet</p>
          <p className="mt-1 text-muted-foreground">Discover a profile and claim #1.</p>
        </div>
      ) : (
        <ol className="mt-6 overflow-hidden rounded-3xl border border-border bg-card">
          {rows.map((r, i) => (
            <li key={r.id} className={cn("flex items-center gap-4 border-b border-border p-4 last:border-0", i < 3 && "bg-linear-to-r from-amber-500/5 to-transparent")}>
              <span className="w-8 text-center font-display text-lg font-bold text-muted-foreground tabular-nums">{["🥇", "🥈", "🥉"][i] ?? i + 1}</span>
              <Avatar src={r.image} name={r.name} className="size-11" />
              <div className="min-w-0 flex-1">
                {r.username ? (
                  <Link href={`/c/${r.username}`} className="block truncate font-semibold hover:underline">
                    {r.name}
                  </Link>
                ) : (
                  <span className="block truncate font-semibold">{r.name}</span>
                )}
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <LevelPill xp={r.xp} />
                  {r.streak > 1 && (
                    <span className="inline-flex items-center gap-0.5">
                      <Flame className="size-3 text-orange-500" /> {r.streak}-day streak
                    </span>
                  )}
                </span>
              </div>
              <span className="text-right">
                <span className="block font-display text-lg font-bold tabular-nums">{formatCompact(r.score)}</span>
                <span className="text-xs text-muted-foreground">XP</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

async function Discoverers() {
  const rows = await cachedTopDiscoverers();
  if (!rows.length) return <p className="mt-3 text-sm text-muted-foreground">No discoveries yet.</p>;
  return (
    <ol className="mt-4 space-y-3">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center gap-3 text-sm">
          <Avatar src={r.image} name={r.name} className="size-8" />
          {r.username ? (
            <Link href={`/c/${r.username}`} className="flex-1 truncate font-medium hover:underline">
              {r.name}
            </Link>
          ) : (
            <span className="flex-1 truncate font-medium">{r.name}</span>
          )}
          <span className="text-muted-foreground">🧭 {r.discoveries}</span>
        </li>
      ))}
    </ol>
  );
}

function BoardSkeleton() {
  return (
    <div className="mt-6 space-y-2">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  );
}
