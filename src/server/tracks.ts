import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { activities, playlists, profiles, tracks } from "@/db/schema";
import { XP } from "@/lib/gamification";
import type { MusicRef, PlatformId } from "@/lib/platforms";
import { fetchTrackMeta, mapLimit } from "./metadata";
import { awardXp, syncBadges } from "./xp";

/** A music link found in a post, ready to be stored. */
export interface FoundTrack {
  ref: MusicRef;
  tweetId: string;
  tweetedAt: Date;
  text: string;
}

/**
 * Enrich and store new tracks for a profile (one playlist per platform).
 * Already-stored tracks are skipped, so this is safe to call repeatedly.
 * Returns how many tracks were added.
 */
export async function storeTracks(profileId: string, found: FoundTrack[]): Promise<number> {
  if (!found.length) return 0;

  const existing = await db
    .select({ platform: tracks.platform, externalId: tracks.externalId })
    .from(tracks)
    .where(eq(tracks.profileId, profileId));
  const known = new Set(existing.map((t) => `${t.platform}:${t.externalId}`));
  const fresh = found.filter((f) => !known.has(`${f.ref.platform}:${f.ref.externalId}`));
  if (!fresh.length) return 0;

  const enriched = await mapLimit(fresh, 6, async (f) => ({ ...f, meta: await fetchTrackMeta(f.ref) }));

  const platforms = [...new Set(enriched.map((e) => e.ref.platform))];
  const playlistIds = new Map<PlatformId, string>();
  const rows = await db
    .insert(playlists)
    .values(platforms.map((platform) => ({ profileId, platform })))
    .onConflictDoUpdate({ target: [playlists.profileId, playlists.platform], set: { updatedAt: new Date() } })
    .returning({ id: playlists.id, platform: playlists.platform });
  for (const r of rows) playlistIds.set(r.platform, r.id);

  let added = 0;
  for (let i = 0; i < enriched.length; i += 200) {
    const inserted = await db
      .insert(tracks)
      .values(
        enriched.slice(i, i + 200).map(({ ref, tweetId, tweetedAt, text, meta }) => ({
          profileId,
          playlistId: playlistIds.get(ref.platform)!,
          platform: ref.platform,
          kind: ref.kind,
          externalId: ref.externalId,
          url: ref.url,
          title: meta.title,
          artist: meta.artist,
          thumbnailUrl: meta.thumbnailUrl,
          tweetId,
          tweetText: text.slice(0, 500),
          tweetedAt,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: tracks.id });
    added += inserted.length;
  }
  return added;
}

/** Recompute playlist/profile counters and covers. Returns the profile's track total. */
export async function recountProfile(profileId: string): Promise<number> {
  await db.execute(sql`
    update ${playlists} p set
      track_count = (select count(*) from ${tracks} t where t.playlist_id = p.id),
      cover_url = coalesce(
        (select t.thumbnail_url from ${tracks} t where t.playlist_id = p.id and t.thumbnail_url is not null order by t.tweeted_at desc limit 1),
        p.cover_url)
    where p.profile_id = ${profileId}
  `);
  const [{ total }] = await db.execute<{ total: number }>(
    sql`select count(*)::int as total from ${tracks} where profile_id = ${profileId}`,
  );
  await db.update(profiles).set({ trackCount: total }).where(eq(profiles.id, profileId));
  return total;
}

/** XP, activity and badges for whoever brought a profile to the site first. Idempotent. */
export async function rewardDiscovery(profileId: string, userId: string, total: number) {
  const fresh = await awardXp(userId, "discover", XP.discover, profileId);
  if (total > 0) await awardXp(userId, "discover-tracks", Math.min(total, XP.discoverTrackCap) * XP.discoverPerTrack, profileId);
  if (fresh) await db.insert(activities).values({ type: "discover", actorId: userId, profileId, meta: String(total) });
  await syncBadges(userId);
}
