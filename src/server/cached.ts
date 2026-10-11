import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { PlatformId } from "@/lib/platforms";
import * as q from "./queries";

/**
 * Public, viewer-independent reads cached with `use cache` so they can be part
 * of the prerendered static shell and served from the CDN.
 *
 * Failures (e.g. no database during a local `next build`) degrade to empty
 * results; the short `minutes` profile means they heal within a minute.
 */
async function safe<T>(label: string, fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[cached:${label}]`, err instanceof Error ? err.message : err);
    return fallback;
  }
}

export async function cachedSiteStats() {
  "use cache";
  cacheLife("minutes");
  cacheTag("stats");
  return safe("stats", { profiles: 0, tracks: 0, curators: 0 }, q.getSiteStats);
}

export async function cachedTrending(limit = 12, platform?: PlatformId) {
  "use cache";
  cacheLife("minutes");
  cacheTag("playlists");
  return safe("trending", [], () => q.getTrendingPlaylists(limit, platform));
}

export async function cachedTopProfiles(limit = 12) {
  "use cache";
  cacheLife("minutes");
  cacheTag("profiles");
  return safe("top-profiles", [], () => q.getTopProfiles(limit));
}

export async function cachedNewestProfiles(limit = 12) {
  "use cache";
  cacheLife("minutes");
  cacheTag("profiles");
  return safe("newest-profiles", [], () => q.getNewestProfiles(limit));
}

export async function cachedSearch(term: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("profiles");
  return safe("search", [], () => q.searchProfiles(term));
}

export async function cachedLeaderboard(period: "week" | "all") {
  "use cache";
  cacheLife("minutes");
  cacheTag("leaderboard");
  return safe("leaderboard", [], () => q.getLeaderboard(period));
}

export async function cachedTopDiscoverers() {
  "use cache";
  cacheLife("minutes");
  cacheTag("leaderboard");
  return safe("discoverers", [], () => q.getTopDiscoverers());
}

export async function cachedActivity(limit = 20) {
  "use cache";
  cacheLife("minutes");
  cacheTag("activity");
  return safe("activity", [], () => q.getActivityFeed(limit));
}

export async function cachedRelated(platform: PlatformId, excludeId: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("playlists");
  return safe("related", [], () => q.getRelatedPlaylists(platform, excludeId));
}

/** Lightweight profile lookup for metadata / OG images. */
export async function cachedProfileMeta(handle: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`profile:${handle.toLowerCase()}`);
  return safe("profile-meta", null, async () => {
    const row = await q.getProfile(handle);
    if (!row) return null;
    const playlists = await q.getProfilePlaylists(row.profile.id);
    return { profile: row.profile, playlists };
  });
}

export async function cachedPlaylistMeta(handle: string, platform: PlatformId) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`profile:${handle.toLowerCase()}`);
  return safe("playlist-meta", null, async () => {
    const row = await q.getPlaylist(handle, platform);
    if (!row) return null;
    return { profile: row.profile, playlist: row.playlist, tracks: row.tracks.slice(0, 20) };
  });
}

export async function cachedSitemap() {
  "use cache";
  cacheLife("hours");
  return safe("sitemap", { playlists: [], curators: [] }, async () => ({
    playlists: await q.getSitemapEntries(),
    curators: await q.getSitemapCurators(),
  }));
}
