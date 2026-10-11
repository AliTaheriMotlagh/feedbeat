import "server-only";
import { and, asc, count, desc, eq, gt, gte, ilike, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  activities,
  comments,
  playlistLikes,
  playlists,
  profileFollows,
  profiles,
  tracks,
  user,
  userBadges,
  xpEvents,
} from "@/db/schema";
import type { PlatformId } from "@/lib/platforms";

/** Profiles that are safe to list publicly. */
const listable = and(eq(profiles.hidden, false), eq(profiles.status, "ready"), gt(profiles.trackCount, 0));

const curator = {
  id: user.id,
  name: user.name,
  username: user.username,
  image: user.image,
  xp: user.xp,
};

/* --------------------------------- Profiles -------------------------------- */

export async function getProfile(handle: string) {
  const [row] = await db
    .select({ profile: profiles, discoveredBy: curator })
    .from(profiles)
    .leftJoin(user, eq(user.id, profiles.discoveredById))
    .where(and(eq(profiles.handle, handle.toLowerCase()), eq(profiles.hidden, false)));
  return row ?? null;
}

export async function getProfilePlaylists(profileId: string) {
  return db
    .select()
    .from(playlists)
    .where(and(eq(playlists.profileId, profileId), gt(playlists.trackCount, 0)))
    .orderBy(desc(playlists.trackCount));
}

export async function getRecentTracks(profileId: string, limit = 12) {
  return db.select().from(tracks).where(eq(tracks.profileId, profileId)).orderBy(desc(tracks.tweetedAt)).limit(limit);
}

export async function getTopArtists(profileId: string, limit = 8) {
  return db
    .select({ artist: tracks.artist, n: count() })
    .from(tracks)
    .where(and(eq(tracks.profileId, profileId), sql`${tracks.artist} is not null`))
    .groupBy(tracks.artist)
    .orderBy(desc(count()))
    .limit(limit);
}

export async function searchProfiles(q: string, limit = 24) {
  const term = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  return db
    .select()
    .from(profiles)
    .where(and(listable, or(ilike(profiles.handle, term), ilike(profiles.name, term))))
    .orderBy(desc(profiles.trackCount))
    .limit(limit);
}

export async function getTopProfiles(limit = 12) {
  return db.select().from(profiles).where(listable).orderBy(desc(profiles.trackCount)).limit(limit);
}

export async function getNewestProfiles(limit = 12) {
  return db.select().from(profiles).where(listable).orderBy(desc(profiles.lastScannedAt)).limit(limit);
}

/* --------------------------------- Playlists ------------------------------- */

export async function getPlaylist(handle: string, platform: PlatformId) {
  const [row] = await db
    .select({ playlist: playlists, profile: profiles })
    .from(playlists)
    .innerJoin(profiles, eq(profiles.id, playlists.profileId))
    .where(and(eq(profiles.handle, handle.toLowerCase()), eq(profiles.hidden, false), eq(playlists.platform, platform)));
  if (!row) return null;
  const items = await db
    .select()
    .from(tracks)
    .where(eq(tracks.playlistId, row.playlist.id))
    .orderBy(desc(tracks.tweetedAt))
    .limit(500);
  return { ...row, tracks: items };
}

export type PlaylistCard = Awaited<ReturnType<typeof getTrendingPlaylists>>[number];

const playlistCard = {
  id: playlists.id,
  platform: playlists.platform,
  trackCount: playlists.trackCount,
  likeCount: playlists.likeCount,
  coverUrl: playlists.coverUrl,
  handle: profiles.displayHandle,
  name: profiles.name,
  avatarUrl: profiles.avatarUrl,
};

/** Ranked by likes in the last 7 days, then all-time likes, then size. */
export async function getTrendingPlaylists(limit = 12, platform?: PlatformId) {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const recent = db
    .select({ playlistId: playlistLikes.playlistId, n: count().as("n") })
    .from(playlistLikes)
    .where(gte(playlistLikes.createdAt, weekAgo))
    .groupBy(playlistLikes.playlistId)
    .as("recent");

  return db
    .select({ ...playlistCard, weeklyLikes: sql<number>`coalesce(${recent.n}, 0)::int` })
    .from(playlists)
    .innerJoin(profiles, eq(profiles.id, playlists.profileId))
    .leftJoin(recent, eq(recent.playlistId, playlists.id))
    .where(and(listable, gt(playlists.trackCount, 0), platform ? eq(playlists.platform, platform) : undefined))
    .orderBy(desc(sql`coalesce(${recent.n}, 0)`), desc(playlists.likeCount), desc(playlists.trackCount))
    .limit(limit);
}

export async function getRelatedPlaylists(platform: PlatformId, excludeId: string, limit = 6) {
  return db
    .select({ ...playlistCard, weeklyLikes: sql<number>`0` })
    .from(playlists)
    .innerJoin(profiles, eq(profiles.id, playlists.profileId))
    .where(and(listable, eq(playlists.platform, platform), ne(playlists.id, excludeId), gt(playlists.trackCount, 2)))
    .orderBy(desc(playlists.likeCount), desc(playlists.trackCount))
    .limit(limit);
}

export async function getComments(playlistId: string, limit = 50) {
  return db
    .select({ id: comments.id, body: comments.body, createdAt: comments.createdAt, author: curator })
    .from(comments)
    .innerJoin(user, eq(user.id, comments.userId))
    .where(eq(comments.playlistId, playlistId))
    .orderBy(desc(comments.createdAt))
    .limit(limit);
}

/* ---------------------------------- Viewer --------------------------------- */

export async function viewerLikes(userId: string | undefined, playlistId: string) {
  if (!userId) return false;
  const rows = await db
    .select({ x: sql`1` })
    .from(playlistLikes)
    .where(and(eq(playlistLikes.userId, userId), eq(playlistLikes.playlistId, playlistId)));
  return rows.length > 0;
}

export async function viewerFollows(userId: string | undefined, profileId: string) {
  if (!userId) return false;
  const rows = await db
    .select({ x: sql`1` })
    .from(profileFollows)
    .where(and(eq(profileFollows.userId, userId), eq(profileFollows.profileId, profileId)));
  return rows.length > 0;
}

/** Playlists from profiles the user follows — the personalized home feed. */
export async function getFollowingFeed(userId: string, limit = 24) {
  return db
    .select({ ...playlistCard, weeklyLikes: sql<number>`0`, updatedAt: playlists.updatedAt })
    .from(profileFollows)
    .innerJoin(profiles, eq(profiles.id, profileFollows.profileId))
    .innerJoin(playlists, eq(playlists.profileId, profiles.id))
    .where(and(eq(profileFollows.userId, userId), listable, gt(playlists.trackCount, 0)))
    .orderBy(desc(playlists.updatedAt))
    .limit(limit);
}

/* --------------------------------- Curators -------------------------------- */

export async function getCurator(username: string) {
  const [row] = await db.select().from(user).where(eq(user.username, username.toLowerCase()));
  if (!row) return null;
  const [badges, discoveries, [{ rank }]] = await Promise.all([
    db.select().from(userBadges).where(eq(userBadges.userId, row.id)).orderBy(asc(userBadges.awardedAt)),
    db.select().from(profiles).where(and(eq(profiles.discoveredById, row.id), listable)).orderBy(desc(profiles.trackCount)).limit(24),
    db.select({ rank: sql<number>`count(*)::int + 1` }).from(user).where(gt(user.xp, row.xp)),
  ]);
  return { user: row, badges, discoveries, rank };
}

export async function getLeaderboard(period: "week" | "all", limit = 50) {
  if (period === "all") {
    return db
      .select({ ...curator, score: user.xp, streak: user.streak })
      .from(user)
      .where(gt(user.xp, 0))
      .orderBy(desc(user.xp))
      .limit(limit);
  }
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  return db
    .select({ ...curator, score: sql<number>`sum(${xpEvents.amount})::int`, streak: user.streak })
    .from(xpEvents)
    .innerJoin(user, eq(user.id, xpEvents.userId))
    .where(gte(xpEvents.createdAt, weekAgo))
    .groupBy(user.id)
    .orderBy(desc(sql`sum(${xpEvents.amount})`))
    .limit(limit);
}

export async function getTopDiscoverers(limit = 5) {
  return db
    .select({ ...curator, discoveries: count(profiles.id) })
    .from(profiles)
    .innerJoin(user, eq(user.id, profiles.discoveredById))
    .where(listable)
    .groupBy(user.id)
    .orderBy(desc(count(profiles.id)))
    .limit(limit);
}

/* --------------------------------- Activity -------------------------------- */

export async function getActivityFeed(limit = 20) {
  return db
    .select({
      id: activities.id,
      type: activities.type,
      meta: activities.meta,
      createdAt: activities.createdAt,
      actor: curator,
      profileHandle: profiles.displayHandle,
      profileName: profiles.name,
      profileAvatar: profiles.avatarUrl,
      playlistPlatform: playlists.platform,
    })
    .from(activities)
    .leftJoin(user, eq(user.id, activities.actorId))
    .leftJoin(profiles, eq(profiles.id, activities.profileId))
    .leftJoin(playlists, eq(playlists.id, activities.playlistId))
    .where(or(sql`${activities.profileId} is null`, eq(profiles.hidden, false)))
    .orderBy(desc(activities.createdAt))
    .limit(limit);
}

export async function getSiteStats() {
  const [[p], [t], [u]] = await Promise.all([
    db.select({ n: count() }).from(profiles).where(listable),
    db.select({ n: count() }).from(tracks),
    db.select({ n: count() }).from(user),
  ]);
  return { profiles: p?.n ?? 0, tracks: t?.n ?? 0, curators: u?.n ?? 0 };
}

/* ---------------------------------- Sitemap -------------------------------- */

export async function getSitemapEntries(limit = 45_000) {
  return db
    .select({ handle: profiles.handle, platform: playlists.platform, updatedAt: playlists.updatedAt })
    .from(playlists)
    .innerJoin(profiles, eq(profiles.id, playlists.profileId))
    .where(and(listable, gt(playlists.trackCount, 0)))
    .orderBy(desc(playlists.likeCount))
    .limit(limit);
}

export async function getSitemapCurators(limit = 5_000) {
  return db
    .select({ username: user.username, updatedAt: user.updatedAt })
    .from(user)
    .where(and(sql`${user.username} is not null`, gt(user.xp, 0)))
    .orderBy(desc(user.xp))
    .limit(limit);
}
