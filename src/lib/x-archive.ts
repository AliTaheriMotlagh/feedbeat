/**
 * Parser for the free X "Download an archive of your data" export.
 *
 * Runs in the browser: the archive never leaves the user's device — only the
 * music links we find (plus post id/date/text) are uploaded.
 *
 * Archive data files look like:
 *   window.YTD.tweets.part0 = [ { "tweet": { "id_str": "…", "full_text": "…", "created_at": "…", "entities": { "urls": [ … ] } } } ]
 */

import { isShortLink, parseMusicUrl, type PlatformId } from "./platforms";

export interface ArchiveAccount {
  accountId: string;
  username: string;
  displayName: string | null;
}

export interface ArchiveProfile {
  bio: string | null;
  avatarUrl: string | null;
}

/** One music link found in a post — the unit we upload. */
export interface ArchiveItem {
  url: string;
  tweetId: string;
  tweetedAt: string; // ISO
  text: string;
}

export interface ArchiveScan {
  items: ArchiveItem[];
  tweetsScanned: number;
  byPlatform: Partial<Record<PlatformId, number>>;
  /** Short links (spotify.link, …) that the server must resolve. */
  unresolved: number;
}

/** Data files we need from the archive (`data/<name>.js`, possibly split into parts). */
export function isNeededArchiveFile(path: string): "tweets" | "account" | "profile" | null {
  const name = path.split("/").pop()?.toLowerCase() ?? "";
  if (/^tweets?(-part\d+)?\.js$/.test(name)) return "tweets";
  if (name === "account.js") return "account";
  if (name === "profile.js") return "profile";
  return null;
}

/** Strip the `window.YTD.x.partN =` prefix and parse the JSON array. */
export function parseYtdFile(text: string): unknown[] {
  const start = text.indexOf("[");
  if (start === -1) throw new Error("Not an X archive data file");
  const data = JSON.parse(text.slice(start)) as unknown;
  if (!Array.isArray(data)) throw new Error("Not an X archive data file");
  return data;
}

const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

/** "Wed Oct 10 20:19:24 +0000 2018" → ISO string. Engine-independent. */
export function parseTwitterDate(s: string): string | null {
  const m = /^\w{3} (\w{3}) (\d{2}) (\d{2}:\d{2}:\d{2}) \+0000 (\d{4})$/.exec(s?.trim() ?? "");
  if (m && MONTHS[m[1]]) return `${m[4]}-${MONTHS[m[1]]}-${m[2]}T${m[3]}.000Z`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null;
const str = (v: unknown) => (typeof v === "string" ? v : null);

export function extractAccount(rows: unknown[]): ArchiveAccount | null {
  const a = rows.map((r) => (isRec(r) && isRec(r.account) ? r.account : null)).find(Boolean);
  const accountId = str(a?.accountId);
  const username = str(a?.username);
  if (!accountId || !username) return null;
  // Deliberately ignore e-mail, phone, IPs and other private fields.
  return { accountId, username, displayName: str(a?.accountDisplayName) };
}

export function extractProfile(rows: unknown[]): ArchiveProfile {
  const p = rows.map((r) => (isRec(r) && isRec(r.profile) ? r.profile : null)).find(Boolean);
  const description = isRec(p?.description) ? p.description : null;
  const avatar = str(p?.avatarMediaUrl);
  return {
    bio: str(description?.bio) || null,
    avatarUrl: avatar && /^https:\/\/pbs\.twimg\.com\//.test(avatar) ? avatar : null,
  };
}

/** Collect music links from parsed tweets files, de-duplicated (earliest share wins). */
export function extractMusicLinks(rows: unknown[]): ArchiveScan {
  const found = new Map<string, ArchiveItem>();
  let tweetsScanned = 0;

  for (const row of rows) {
    const t = isRec(row) && isRec(row.tweet) ? row.tweet : isRec(row) ? row : null;
    if (!t) continue;
    tweetsScanned++;
    const tweetId = str(t.id_str) ?? str(t.id);
    const tweetedAt = parseTwitterDate(str(t.created_at) ?? "");
    if (!tweetId || !/^\d{1,25}$/.test(tweetId) || !tweetedAt) continue;

    const entities = isRec(t.entities) ? t.entities : null;
    const urls = Array.isArray(entities?.urls) ? entities.urls : [];
    for (const u of urls) {
      const url = isRec(u) ? (str(u.expanded_url) ?? str(u.url)) : null;
      if (!url) continue;
      const ref = parseMusicUrl(url);
      const key = ref ? `${ref.platform}:${ref.externalId}` : isShortLink(url) ? `short:${url}` : null;
      if (!key) continue;
      const prev = found.get(key);
      if (!prev || prev.tweetedAt > tweetedAt) {
        found.set(key, { url: ref?.url ?? url, tweetId, tweetedAt, text: (str(t.full_text) ?? str(t.text) ?? "").slice(0, 500) });
      }
    }
  }

  const byPlatform: Partial<Record<PlatformId, number>> = {};
  let unresolved = 0;
  for (const [key] of found) {
    if (key.startsWith("short:")) unresolved++;
    else {
      const p = key.split(":")[0] as PlatformId;
      byPlatform[p] = (byPlatform[p] ?? 0) + 1;
    }
  }

  const items = [...found.values()].sort((a, b) => (a.tweetedAt < b.tweetedAt ? 1 : -1));
  return { items, tweetsScanned, byPlatform, unresolved };
}
