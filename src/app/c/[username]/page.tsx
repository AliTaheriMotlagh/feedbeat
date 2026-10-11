import { Flame } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import type { ProfilePage } from "schema-dts";
import { Avatar } from "@/components/avatar";
import { JsonLd } from "@/components/json-ld";
import { ProfileCard } from "@/components/profile-card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { BADGES, levelFromXp, type BadgeId } from "@/lib/gamification";
import { absoluteUrl, site } from "@/lib/site";
import { cn, formatCompact } from "@/lib/utils";
import { getCurator } from "@/server/queries";

export async function generateMetadata({ params }: PageProps<"/c/[username]">): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `${username} — curator on ${site.name}`,
    description: `See the X profiles ${username} discovered, their badges and rank on ${site.name}.`,
    alternates: { canonical: `/c/${username.toLowerCase()}` },
  };
}

export default function CuratorRoute({ params }: PageProps<"/c/[username]">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Suspense fallback={<Skeleton className="h-72 rounded-3xl" />}>
        <Curator params={params} />
      </Suspense>
    </div>
  );
}

async function Curator({ params }: Pick<PageProps<"/c/[username]">, "params">) {
  await connection();
  const { username } = await params;
  const data = await getCurator(username);
  if (!data) notFound();
  const { user, badges, discoveries, rank } = data;
  const lvl = levelFromXp(user.xp);
  const earned = new Set(badges.map((b) => b.badge));

  return (
    <>
      <header className="relative isolate overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div aria-hidden className="absolute -top-24 -right-24 -z-10 size-72 rounded-full bg-[radial-gradient(closest-side,var(--glow),transparent)]" />
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <Avatar src={user.image} name={user.name} className="size-24 text-3xl" />
          <div className="flex-1">
            <h1 className="font-display text-3xl font-extrabold tracking-tight">{user.name}</h1>
            <p className="text-muted-foreground">
              {lvl.title} · Level {lvl.level} · Rank #{rank}
            </p>
            <div className="mt-4 max-w-md">
              <Progress value={lvl.progress} label="Level progress" />
              <p className="mt-1 text-xs text-muted-foreground">
                {formatCompact(user.xp)} XP · {formatCompact((lvl.next ?? 0) - user.xp)} to level {lvl.level + 1}
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-4 text-center">
            <div>
              <dd className="font-display text-2xl font-bold">{discoveries.length}</dd>
              <dt className="text-xs text-muted-foreground">discoveries</dt>
            </div>
            <div>
              <dd className="font-display text-2xl font-bold">{badges.length}</dd>
              <dt className="text-xs text-muted-foreground">badges</dt>
            </div>
            <div>
              <dd className="flex items-center justify-center gap-1 font-display text-2xl font-bold">
                {user.streak}
                <Flame className="size-5 text-orange-500" />
              </dd>
              <dt className="text-xs text-muted-foreground">day streak</dt>
            </div>
          </dl>
        </div>
      </header>

      <section className="mt-10" aria-labelledby="badges-title">
        <h2 id="badges-title" className="font-display text-2xl font-bold">
          Badges
        </h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {(Object.keys(BADGES) as BadgeId[]).map((id) => {
            const b = BADGES[id];
            const has = earned.has(id);
            return (
              <li
                key={id}
                className={cn("rounded-2xl border border-border p-4 text-center", has ? "bg-card" : "opacity-40 grayscale")}
                title={b.description}
              >
                <span className="text-3xl" aria-hidden>
                  {b.emoji}
                </span>
                <p className="mt-2 text-sm font-semibold">{b.name}</p>
                <p className="text-xs text-muted-foreground">{has ? "Unlocked" : b.description}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="disc-title">
        <h2 id="disc-title" className="font-display text-2xl font-bold">
          Discoveries
        </h2>
        {discoveries.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {discoveries.map((p) => (
              <ProfileCard key={p.id} p={p} />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-muted-foreground">No discoveries yet.</p>
        )}
      </section>

      <JsonLd<ProfilePage>
        data={{
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          url: absoluteUrl(`/c/${user.username}`),
          mainEntity: { "@type": "Person", name: user.name, image: user.image ?? undefined },
        }}
      />
    </>
  );
}
