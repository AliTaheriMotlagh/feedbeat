import "server-only";
import { isShortLink, type MusicRef } from "@/lib/platforms";

export interface TrackMeta {
  title: string | null;
  artist: string | null;
  thumbnailUrl: string | null;
}

const EMPTY: TrackMeta = { title: null, artist: null, thumbnailUrl: null };
const UA = "Mozilla/5.0 (compatible; FeedbeatBot/1.0; +https://feedbeat.app/about)";

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6_000) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Fetch a page's OpenGraph title/image (only ever called on canonical platform URLs). */
async function getOpenGraph(url: string): Promise<{ title?: string; image?: string; description?: string }> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6_000) });
    if (!res.ok) return {};
    const html = (await res.text()).slice(0, 200_000);
    const pick = (prop: string) =>
      html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1];
    return { title: decode(pick("og:title")), image: pick("og:image"), description: decode(pick("og:description")) };
  } catch {
    return {};
  }
}

function decode(s?: string) {
  return s
    ?.replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Follow redirects for known short-link hosts. Returns the final URL or the input. */
export async function resolveShortLink(url: string): Promise<string> {
  if (!isShortLink(url)) return url;
  try {
    const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(5_000) });
    await res.body?.cancel();
    return res.url || url;
  } catch {
    return url;
  }
}

export async function fetchTrackMeta(ref: MusicRef): Promise<TrackMeta> {
  const [prefix, id] = ref.externalId.includes(":") ? ref.externalId.split(":") : [ref.kind, ref.externalId];

  switch (ref.platform) {
    case "youtube": {
      const o = await getJson<{ title: string; author_name: string; thumbnail_url: string }>(
        `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(ref.url)}`,
      );
      return o
        ? {
            title: o.title,
            artist: o.author_name?.replace(/ - Topic$/, "").replace(/VEVO$/, "") ?? null,
            thumbnailUrl: ref.kind === "video" ? `https://i.ytimg.com/vi/${ref.externalId}/mqdefault.jpg` : o.thumbnail_url,
          }
        : { ...EMPTY, thumbnailUrl: ref.kind === "video" ? `https://i.ytimg.com/vi/${ref.externalId}/mqdefault.jpg` : null };
    }
    case "spotify": {
      const [o, og] = await Promise.all([
        getJson<{ title: string; thumbnail_url: string }>(`https://open.spotify.com/oembed?url=${encodeURIComponent(ref.url)}`),
        ref.kind === "track" || ref.kind === "album" ? getOpenGraph(ref.url) : Promise.resolve({ description: undefined }),
      ]);
      // og:description looks like "The Weeknd · After Hours · Song · 2020"
      const artist = og.description?.split(" · ")[0] ?? null;
      return { title: o?.title ?? null, artist, thumbnailUrl: o?.thumbnail_url ?? null };
    }
    case "soundcloud": {
      const o = await getJson<{ title: string; author_name: string; thumbnail_url: string }>(
        `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(ref.url)}`,
      );
      if (!o) return EMPTY;
      return {
        title: o.title.replace(new RegExp(` by ${escapeRe(o.author_name)}$`), ""),
        artist: o.author_name,
        thumbnailUrl: o.thumbnail_url,
      };
    }
    case "deezer": {
      const d = await getJson<{
        title?: string;
        artist?: { name: string };
        creator?: { name: string };
        album?: { cover_medium: string };
        cover_medium?: string;
        picture_medium?: string;
        error?: unknown;
      }>(`https://api.deezer.com/${prefix}/${id}`);
      if (!d || d.error) return EMPTY;
      return {
        title: d.title ?? null,
        artist: d.artist?.name ?? d.creator?.name ?? null,
        thumbnailUrl: d.album?.cover_medium ?? d.cover_medium ?? d.picture_medium ?? null,
      };
    }
    case "apple": {
      if (prefix === "playlist") {
        const og = await getOpenGraph(ref.url);
        return { title: og.title ?? null, artist: null, thumbnailUrl: og.image ?? null };
      }
      const d = await getJson<{
        results: { trackName?: string; collectionName?: string; artistName?: string; artworkUrl100?: string }[];
      }>(`https://itunes.apple.com/lookup?id=${id}`);
      const r = d?.results?.[0];
      if (!r) return EMPTY;
      return {
        title: r.trackName ?? r.collectionName ?? null,
        artist: r.artistName ?? null,
        thumbnailUrl: r.artworkUrl100?.replace("100x100bb", "300x300bb") ?? null,
      };
    }
    case "tidal":
    case "bandcamp": {
      const og = await getOpenGraph(ref.url);
      // Bandcamp: "Song Title, by Artist"
      const m = og.title?.match(/^(.*), by (.*)$/);
      return {
        title: m?.[1] ?? og.title ?? null,
        artist: m?.[2] ?? null,
        thumbnailUrl: og.image ?? null,
      };
    }
  }
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Run async work over items with bounded concurrency. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
