/**
 * Music platform registry + URL parsing.
 *
 * Every link found in a tweet goes through `parseMusicUrl`. If it points at a
 * piece of music on a supported platform we get back a normalized reference
 * (platform, kind, stable id, canonical url) used for de-duplication, embeds
 * and exports.
 */

export const PLATFORM_IDS = [
  "spotify",
  "youtube",
  "apple",
  "soundcloud",
  "deezer",
  "tidal",
  "bandcamp",
] as const;

export type PlatformId = (typeof PLATFORM_IDS)[number];

export type MediaKind =
  | "track"
  | "album"
  | "playlist"
  | "artist"
  | "video"
  | "episode"
  | "show";

export interface Platform {
  id: PlatformId;
  name: string;
  /** Brand color, used for accents. */
  color: string;
  /** URL path segment, e.g. /u/elonmusk/spotify */
  slug: string;
  tagline: string;
}

export const PLATFORMS: Record<PlatformId, Platform> = {
  spotify: { id: "spotify", name: "Spotify", color: "#1DB954", slug: "spotify", tagline: "Tracks, albums & podcasts" },
  youtube: { id: "youtube", name: "YouTube", color: "#FF0033", slug: "youtube", tagline: "Music videos & live sets" },
  apple: { id: "apple", name: "Apple Music", color: "#FA243C", slug: "apple", tagline: "Songs & albums" },
  soundcloud: { id: "soundcloud", name: "SoundCloud", color: "#FF5500", slug: "soundcloud", tagline: "Mixes, demos & remixes" },
  deezer: { id: "deezer", name: "Deezer", color: "#A238FF", slug: "deezer", tagline: "Tracks & albums" },
  tidal: { id: "tidal", name: "TIDAL", color: "#00FFFF", slug: "tidal", tagline: "Hi-fi tracks & albums" },
  bandcamp: { id: "bandcamp", name: "Bandcamp", color: "#1DA0C3", slug: "bandcamp", tagline: "Independent releases" },
};

export function isPlatformId(value: string): value is PlatformId {
  return (PLATFORM_IDS as readonly string[]).includes(value);
}

export interface MusicRef {
  platform: PlatformId;
  kind: MediaKind;
  /** Stable id, unique per platform (kind-prefixed where ids could collide). */
  externalId: string;
  /** Canonical, tracker-free URL. */
  url: string;
}

/** Hosts that only redirect — they must be resolved before parsing. */
const SHORTENER_HOSTS = new Set([
  "spotify.link",
  "spoti.fi",
  "on.soundcloud.com",
  "deezer.page.link",
  "link.deezer.com",
  "tidal.link",
  "apple.co",
]);

export function isShortLink(raw: string): boolean {
  const url = safeUrl(raw);
  return url ? SHORTENER_HOSTS.has(url.hostname.toLowerCase()) : false;
}

function safeUrl(raw: string): URL | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;

export function parseMusicUrl(raw: string): MusicRef | null {
  const url = safeUrl(raw);
  if (!url) return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  // ---- Spotify ------------------------------------------------------------
  if (host === "open.spotify.com" || host === "play.spotify.com") {
    // Optional locale prefix: /intl-de/track/{id}
    const p = parts[0]?.startsWith("intl-") ? parts.slice(1) : parts;
    // Legacy: /user/{user}/playlist/{id}
    const typeIdx = p[0] === "user" && p[2] === "playlist" ? 2 : 0;
    const type = p[typeIdx];
    const id = p[typeIdx + 1];
    const kinds: Record<string, MediaKind> = {
      track: "track",
      album: "album",
      playlist: "playlist",
      artist: "artist",
      episode: "episode",
      show: "show",
    };
    if (type && id && kinds[type] && SPOTIFY_ID.test(id)) {
      return {
        platform: "spotify",
        kind: kinds[type],
        externalId: `${type}:${id}`,
        url: `https://open.spotify.com/${type}/${id}`,
      };
    }
    return null;
  }

  // ---- YouTube / YouTube Music --------------------------------------------
  if (host === "youtube.com" || host === "music.youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com") {
    let videoId: string | null = null;
    if (host === "youtu.be") videoId = parts[0] ?? null;
    else if (parts[0] === "watch") videoId = url.searchParams.get("v");
    else if (["shorts", "embed", "live", "v"].includes(parts[0] ?? "")) videoId = parts[1] ?? null;

    if (videoId && YT_ID.test(videoId)) {
      return {
        platform: "youtube",
        kind: "video",
        externalId: videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      };
    }
    const list = url.searchParams.get("list");
    if (parts[0] === "playlist" && list && /^[A-Za-z0-9_-]{10,64}$/.test(list)) {
      return {
        platform: "youtube",
        kind: "playlist",
        externalId: `playlist:${list}`,
        url: `https://www.youtube.com/playlist?list=${list}`,
      };
    }
    return null;
  }

  // ---- Apple Music ----------------------------------------------------------
  if (host === "music.apple.com" || host === "itunes.apple.com") {
    // /{country}/album/{slug}/{albumId}?i={trackId}  |  /{country}/song/{slug}/{id}
    const country = /^[a-z]{2}$/.test(parts[0] ?? "") ? parts[0] : "us";
    const rest = /^[a-z]{2}$/.test(parts[0] ?? "") ? parts.slice(1) : parts;
    const type = rest[0];
    const last = rest[rest.length - 1] ?? "";
    const trackId = url.searchParams.get("i");
    if (type === "album" && trackId && /^\d+$/.test(trackId)) {
      return {
        platform: "apple",
        kind: "track",
        externalId: `song:${trackId}`,
        url: `https://music.apple.com/${country}/song/${trackId}`,
      };
    }
    const id = last.replace(/^id/, "");
    if (type === "song" && /^\d+$/.test(id)) {
      return { platform: "apple", kind: "track", externalId: `song:${id}`, url: `https://music.apple.com/${country}/song/${id}` };
    }
    if (type === "album" && /^\d+$/.test(id)) {
      return { platform: "apple", kind: "album", externalId: `album:${id}`, url: `https://music.apple.com/${country}/album/${id}` };
    }
    if (type === "playlist" && /^pl\.[A-Za-z0-9-]+$/.test(last)) {
      return {
        platform: "apple",
        kind: "playlist",
        externalId: `playlist:${last}`,
        url: `https://music.apple.com/${country}/playlist/${rest[1] ?? "playlist"}/${last}`,
      };
    }
    return null;
  }

  // ---- SoundCloud -----------------------------------------------------------
  if (host === "soundcloud.com") {
    const reserved = new Set(["discover", "stream", "search", "you", "upload", "pages", "terms-of-use", "charts", "mobile"]);
    if (!parts[0] || reserved.has(parts[0])) return null;
    if (parts.length === 2 && !["tracks", "albums", "sets", "reposts", "likes", "followers", "following", "popular-tracks"].includes(parts[1])) {
      const path = `${parts[0]}/${parts[1]}`.toLowerCase();
      return { platform: "soundcloud", kind: "track", externalId: path, url: `https://soundcloud.com/${path}` };
    }
    if (parts.length === 3 && parts[1] === "sets") {
      const path = `${parts[0]}/sets/${parts[2]}`.toLowerCase();
      return { platform: "soundcloud", kind: "playlist", externalId: path, url: `https://soundcloud.com/${path}` };
    }
    return null;
  }

  // ---- Deezer ---------------------------------------------------------------
  if (host === "deezer.com") {
    // Optional locale: /fr/track/{id}
    const p = /^[a-z]{2}$/.test(parts[0] ?? "") ? parts.slice(1) : parts;
    const [type, id] = p;
    if (type && id && /^\d+$/.test(id) && ["track", "album", "playlist", "episode"].includes(type)) {
      return {
        platform: "deezer",
        kind: type as MediaKind,
        externalId: `${type}:${id}`,
        url: `https://www.deezer.com/${type}/${id}`,
      };
    }
    return null;
  }

  // ---- TIDAL ----------------------------------------------------------------
  if (host === "tidal.com" || host === "listen.tidal.com") {
    // /browse/track/{id} | /track/{id} | /album/{id}/track/{id}
    const idx = parts.lastIndexOf("track");
    if (idx !== -1 && /^\d+$/.test(parts[idx + 1] ?? "")) {
      const id = parts[idx + 1];
      return { platform: "tidal", kind: "track", externalId: `track:${id}`, url: `https://tidal.com/browse/track/${id}` };
    }
    const aidx = parts.lastIndexOf("album");
    if (aidx !== -1 && /^\d+$/.test(parts[aidx + 1] ?? "")) {
      const id = parts[aidx + 1];
      return { platform: "tidal", kind: "album", externalId: `album:${id}`, url: `https://tidal.com/browse/album/${id}` };
    }
    return null;
  }

  // ---- Bandcamp -------------------------------------------------------------
  if (host.endsWith(".bandcamp.com") && (parts[0] === "track" || parts[0] === "album") && parts[1]) {
    const artist = host.replace(/\.bandcamp\.com$/, "");
    const path = `${artist}/${parts[0]}/${parts[1]}`.toLowerCase();
    return {
      platform: "bandcamp",
      kind: parts[0] as MediaKind,
      externalId: path,
      url: `https://${artist}.bandcamp.com/${parts[0]}/${parts[1].toLowerCase()}`,
    };
  }

  return null;
}

/** Embeddable player URL for a ref, or null when the platform has no embed. */
export function embedUrl(ref: Pick<MusicRef, "platform" | "kind" | "externalId" | "url">, opts: { dark?: boolean } = {}): string | null {
  const [prefix, id] = ref.externalId.includes(":") ? ref.externalId.split(":") : [ref.kind, ref.externalId];
  switch (ref.platform) {
    case "spotify":
      return `https://open.spotify.com/embed/${prefix}/${id}?utm_source=feedbeat${opts.dark ? "&theme=0" : ""}`;
    case "youtube":
      return ref.kind === "playlist"
        ? `https://www.youtube-nocookie.com/embed/videoseries?list=${id}&autoplay=1`
        : `https://www.youtube-nocookie.com/embed/${ref.externalId}?autoplay=1&rel=0`;
    case "apple":
      return ref.url.replace("https://music.apple.com", "https://embed.music.apple.com");
    case "soundcloud":
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(ref.url)}&color=%23ff5500&auto_play=true&visual=true`;
    case "deezer":
      return `https://widget.deezer.com/widget/${opts.dark ? "dark" : "light"}/${prefix}/${id}`;
    case "tidal":
      return `https://embed.tidal.com/${prefix}s/${id}`;
    case "bandcamp":
      return null;
  }
}

/** Preferred iframe height per platform/kind. */
export function embedHeight(ref: Pick<MusicRef, "platform" | "kind">): number {
  if (ref.platform === "youtube") return 0; // uses 16:9 aspect ratio instead
  if (ref.platform === "soundcloud") return 300;
  if (ref.platform === "spotify") return ref.kind === "track" || ref.kind === "episode" ? 152 : 352;
  if (ref.platform === "apple") return ref.kind === "track" ? 175 : 450;
  return 300;
}
