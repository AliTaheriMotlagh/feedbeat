import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ActivityFeed } from "@/components/activity-feed";
import { PlaylistCard } from "@/components/playlist-card";
import { SignInCta } from "@/components/sign-in-cta";
import { Skeleton } from "@/components/ui/skeleton";
import { getSession } from "@/lib/auth";
import { getFollowingFeed } from "@/server/queries";

export const metadata: Metadata = {
  title: "Your feed",
  description: "New music from the profiles you follow, plus live community activity.",
  robots: { index: false },
};

export default function FeedPage() {
  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section aria-labelledby="following-title">
        <h1 id="following-title" className="font-display text-4xl font-extrabold tracking-tight">
          Your feed
        </h1>
        <p className="mt-2 text-muted-foreground">Fresh playlists from the profiles you follow.</p>
        <Suspense fallback={<Skeleton className="mt-6 h-96 rounded-3xl" />}>
          <Following />
        </Suspense>
      </section>
      <aside aria-labelledby="activity-title">
        <h2 id="activity-title" className="mb-3 font-display text-xl font-bold">
          Community activity
        </h2>
        <Suspense fallback={<Skeleton className="h-96" />}>
          <ActivityFeed limit={25} />
        </Suspense>
      </aside>
    </div>
  );
}

async function Following() {
  await connection();
  const session = await getSession();
  if (!session) return <SignInCta className="mt-6" message="Sign in to follow profiles and get their new finds here." />;

  const items = await getFollowingFeed(session.user.id);
  if (!items.length) {
    return (
      <div className="mt-6 rounded-3xl border border-dashed border-border p-10 text-center">
        <p className="font-display text-lg font-semibold">You&apos;re not following anyone yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Open any profile and hit Follow — their playlists will land here.</p>
      </div>
    );
  }
  return (
    <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
      {items.map((p) => (
        <PlaylistCard key={p.id} p={p} />
      ))}
    </div>
  );
}
