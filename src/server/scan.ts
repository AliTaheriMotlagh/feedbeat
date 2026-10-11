import "server-only";
import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { profiles, type Profile } from "@/db/schema";
import { env, useDemoTweets } from "@/env";
import { parseMusicUrl, type MusicRef } from "@/lib/platforms";
import { demoTweets, demoUser } from "./demo-tweets";
import { mapLimit, resolveShortLink } from "./metadata";
import { recountProfile, rewardDiscovery, storeTracks } from "./tracks";
import { XApiError, getUserByUsername, getUserTweets, tweetUrls, type XTweet } from "./x-api";

/** A profile is re-scannable after this long. */
export const RESCAN_AFTER_MS = 6 * 60 * 60 * 1000;
/** A scan stuck longer than this is considered dead and can be reclaimed. */
const STALE_SCAN_MS = 5 * 60 * 1000;

/** Whether a profile's playlists are old enough to be refreshed. */
export function canRescan(lastScannedAt: Date | null, now = Date.now()) {
  return !lastScannedAt || now - lastScannedAt.getTime() > RESCAN_AFTER_MS;
}

export const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;

export function normalizeHandle(input: string): string | null {
  const h = input
    .trim()
    .replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0];
  return HANDLE_RE.test(h) ? h : null;
}

export type ScanRequest =
  | { ok: true; profile: Profile; started: boolean }
  | { ok: false; error: string };

/**
 * Create or reuse the profile row and claim it for scanning.
 * The caller runs `runScan(profile.id)` (usually inside `after()`) when `started` is true.
 */
export async function requestScan(handleInput: string, userId: string | null): Promise<ScanRequest> {
  const display = normalizeHandle(handleInput);
  if (!display) return { ok: false, error: "That doesn't look like a valid X handle." };
  const handle = display.toLowerCase();

  const [created] = await db
    .insert(profiles)
    .values({ handle, displayHandle: display, discoveredById: userId, status: "queued" })
    .onConflictDoNothing({ target: profiles.handle })
    .returning();

  if (created) {
    await claim(created.id, true);
    return { ok: true, profile: created, started: true };
  }

  const [existing] = await db.select().from(profiles).where(eq(profiles.handle, handle));
  if (!existing) return { ok: false, error: "Something went wrong, please retry." };
  if (existing.hidden) return { ok: false, error: "This profile has opted out of Feedbeat." };

  const started = await claim(existing.id, false);
  return { ok: true, profile: existing, started };
}

/** Atomically move a profile into "scanning" if it is idle and stale enough. */
async function claim(profileId: string, isNew: boolean): Promise<boolean> {
  const now = Date.now();
  const rescanBefore = new Date(now - RESCAN_AFTER_MS);
  const staleBefore = new Date(now - STALE_SCAN_MS);

  const rows = await db
    .update(profiles)
    .set({ status: "scanning", scanStartedAt: new Date(), statusMessage: "Starting…" })
    .where(
      and(
        eq(profiles.id, profileId),
        isNew
          ? undefined
          : or(
              eq(profiles.status, "error"),
              and(eq(profiles.status, "ready"), or(sql`${profiles.lastScannedAt} is null`, lt(profiles.lastScannedAt, rescanBefore))),
              and(inArray(profiles.status, ["scanning", "queued"]), or(sql`${profiles.scanStartedAt} is null`, lt(profiles.scanStartedAt, staleBefore))),
            ),
      ),
    )
    .returning({ id: profiles.id });
  return rows.length > 0;
}

async function setStatus(profileId: string, statusMessage: string) {
  await db.update(profiles).set({ statusMessage }).where(eq(profiles.id, profileId));
}

interface Found {
  ref: MusicRef;
  tweet: XTweet;
}

/** The actual scan. Safe to call repeatedly; inserts are idempotent. */
export async function runScan(profileId: string): Promise<void> {
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId));
  if (!profile) return;
  const isFirstScan = !profile.lastScannedAt;

  try {
    // 1. Look up the account.
    await setStatus(profileId, "Looking up the account…");
    const xUser = useDemoTweets ? demoUser(profile.displayHandle) : await getUserByUsername(profile.displayHandle);
    await db
      .update(profiles)
      .set({
        xUserId: xUser.id,
        displayHandle: xUser.username,
        name: xUser.name,
        bio: xUser.description ?? null,
        avatarUrl: xUser.profile_image_url?.replace("_normal", "_400x400") ?? null,
        verified: Boolean(xUser.verified),
        followersCount: xUser.public_metrics?.followers_count ?? 0,
      })
      .where(eq(profiles.id, profileId));

    // 2. Read the timeline and collect music links.
    const found = new Map<string, Found>();
    let scanned = 0;
    let newestId: string | null = null;
    const pages = useDemoTweets
      ? demoTweets(xUser.username)
      : getUserTweets(xUser.id, { sinceId: profile.newestTweetId, maxTweets: env.SCAN_MAX_TWEETS });

    for await (const page of pages) {
      newestId ??= page[0]?.id ?? null;
      scanned += page.length;
      await setStatus(profileId, `Read ${scanned.toLocaleString("en-US")} posts · ${found.size} songs so far`);

      const candidates = page.flatMap((tweet) => tweetUrls(tweet).map((url) => ({ url, tweet })));
      const resolved = await mapLimit(candidates, 8, async (c) => ({ ...c, url: await resolveShortLink(c.url) }));
      for (const { url, tweet } of resolved) {
        const ref = parseMusicUrl(url);
        if (!ref) continue;
        const key = `${ref.platform}:${ref.externalId}`;
        // Pages are newest-first: keep the earliest post that shared each song.
        found.set(key, { ref, tweet });
      }
    }

    // 3. Enrich & store new tracks, then recount.
    await setStatus(profileId, `Fetching details for ${found.size} songs…`);
    await storeTracks(
      profileId,
      [...found.values()].map(({ ref, tweet }) => ({
        ref,
        tweetId: tweet.id,
        tweetedAt: new Date(tweet.created_at),
        text: tweet.note_tweet?.text ?? tweet.text,
      })),
    );
    const total = await recountProfile(profileId);

    await db
      .update(profiles)
      .set({
        status: "ready",
        statusMessage: null,
        tweetsScanned: sql`${profiles.tweetsScanned} + ${scanned}`,
        newestTweetId: newestId ?? profile.newestTweetId,
        lastScannedAt: new Date(),
      })
      .where(eq(profiles.id, profileId));

    // 4. Gamification for whoever discovered this profile.
    if (isFirstScan && profile.discoveredById) await rewardDiscovery(profileId, profile.discoveredById, total);
  } catch (err) {
    const message =
      err instanceof XApiError ? err.message : "We couldn't finish scanning this profile. Please try again later.";
    if (!(err instanceof XApiError)) console.error("[scan] failed", profileId, err);
    await db
      .update(profiles)
      .set({ status: "error", statusMessage: message })
      .where(eq(profiles.id, profileId));
  }
}
