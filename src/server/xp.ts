import "server-only";
import { count, eq, max, sql } from "drizzle-orm";
import { db } from "@/db";
import { activities, comments, playlistLikes, playlists, profiles, user, userBadges, xpEvents } from "@/db/schema";
import { XP, nextStreak, qualifyingBadges, type BadgeId } from "@/lib/gamification";

/** Idempotently award XP. Returns true when the award is new. */
export async function awardXp(userId: string, reason: string, amount: number, refId = ""): Promise<boolean> {
  const inserted = await db
    .insert(xpEvents)
    .values({ userId, reason, amount, refId })
    .onConflictDoNothing()
    .returning({ id: xpEvents.id });
  if (!inserted.length) return false;
  await db.update(user).set({ xp: sql`${user.xp} + ${amount}` }).where(eq(user.id, userId));
  return true;
}

/** Update the daily streak and grant the daily-visit bonus once per UTC day. */
export async function touchStreak(userId: string) {
  const [u] = await db.select({ streak: user.streak, lastActiveOn: user.lastActiveOn }).from(user).where(eq(user.id, userId));
  if (!u) return;
  const today = new Date().toISOString().slice(0, 10);
  const { streak, isNewDay } = nextStreak(u.lastActiveOn, u.streak, today);
  if (!isNewDay) return;
  await db.update(user).set({ streak, lastActiveOn: today }).where(eq(user.id, userId));
  await awardXp(userId, "daily", XP.dailyVisit, today);
  await syncBadges(userId);
}

/** Recompute badge eligibility and persist new badges. Returns newly earned badge ids. */
export async function syncBadges(userId: string): Promise<BadgeId[]> {
  const [[disc], [likesReceived], [commentCount], [likesGiven], [u], owned] = await Promise.all([
    db
      .select({ n: count(), biggest: max(profiles.trackCount) })
      .from(profiles)
      .where(eq(profiles.discoveredById, userId)),
    db
      .select({ n: count() })
      .from(playlistLikes)
      .innerJoin(playlists, eq(playlists.id, playlistLikes.playlistId))
      .innerJoin(profiles, eq(profiles.id, playlists.profileId))
      .where(eq(profiles.discoveredById, userId)),
    db.select({ n: count() }).from(comments).where(eq(comments.userId, userId)),
    db.select({ n: count() }).from(playlistLikes).where(eq(playlistLikes.userId, userId)),
    db.select({ streak: user.streak }).from(user).where(eq(user.id, userId)),
    db.select({ badge: userBadges.badge }).from(userBadges).where(eq(userBadges.userId, userId)),
  ]);

  const have = new Set(owned.map((b) => b.badge));
  const earned = qualifyingBadges({
    discoveries: disc?.n ?? 0,
    biggestDiscovery: disc?.biggest ?? 0,
    likesReceived: likesReceived?.n ?? 0,
    comments: commentCount?.n ?? 0,
    likesGiven: likesGiven?.n ?? 0,
    streak: u?.streak ?? 0,
  }).filter((b) => !have.has(b));

  if (!earned.length) return [];
  await db
    .insert(userBadges)
    .values(earned.map((badge) => ({ userId, badge })))
    .onConflictDoNothing();
  await db.insert(activities).values(earned.map((b) => ({ type: "badge" as const, actorId: userId, meta: b })));
  return earned;
}
