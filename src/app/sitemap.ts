import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";
import { cachedSitemap } from "@/server/cached";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { playlists, curators } = await cachedSitemap();
  const profiles = new Map<string, Date>();
  for (const p of playlists) {
    const prev = profiles.get(p.handle);
    if (!prev || prev < p.updatedAt) profiles.set(p.handle, p.updatedAt);
  }

  return [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/explore"), changeFrequency: "hourly", priority: 0.9 },
    { url: absoluteUrl("/leaderboard"), changeFrequency: "daily", priority: 0.6 },
    { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.4 },
    ...[...profiles].map(([handle, lastModified]) => ({
      url: absoluteUrl(`/u/${handle}`),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...playlists.map((p) => ({
      url: absoluteUrl(`/u/${p.handle}/${p.platform}`),
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...curators
      .filter((c) => c.username)
      .map((c) => ({ url: absoluteUrl(`/c/${c.username}`), lastModified: c.updatedAt, changeFrequency: "weekly" as const, priority: 0.3 })),
  ];
}
