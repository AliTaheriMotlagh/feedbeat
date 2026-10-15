/*
 * Shared helpers for the Feedbeat collector extension.
 * A plain classic script so it runs in content scripts, the service worker
 * and unit tests alike, so everything hangs off one global.
 */
(function (root) {
  "use strict";

  // Keep in sync with host_permissions and content_scripts in manifest.json.
  const SITE_ORIGINS = ["https://feedbeat-nine.vercel.app", "http://localhost:3000"];
  const SITE_URL = SITE_ORIGINS[0];
  const X_ORIGIN = "https://x.com";

  // Pre-filter only: the server re-parses every link with its own rules.
  // host → platform id ("link" = short or smart link, resolved on the server).
  const MUSIC_HOSTS = {
    "open.spotify.com": "spotify",
    "play.spotify.com": "spotify",
    "spotify.link": "spotify",
    "spoti.fi": "spotify",
    "youtube.com": "youtube",
    "youtu.be": "youtube",
    "music.youtube.com": "youtube",
    "music.apple.com": "apple",
    "itunes.apple.com": "apple",
    "apple.co": "apple",
    "soundcloud.com": "soundcloud",
    "on.soundcloud.com": "soundcloud",
    "deezer.com": "deezer",
    "link.deezer.com": "deezer",
    "deezer.page.link": "deezer",
    "tidal.com": "tidal",
    "listen.tidal.com": "tidal",
    "tidal.link": "tidal",
    "bandcamp.com": "bandcamp",
    "audiomack.com": "audiomack",
    "mixcloud.com": "mixcloud",
    "song.link": "link",
    "album.link": "link",
    "odesli.co": "link",
    "lnk.to": "link",
    "ffm.to": "link",
    "found.ee": "link",
    "smarturl.it": "link",
    "fanlink.to": "link",
    "fanlink.tv": "link",
  };
  const HOSTS = Object.keys(MUSIC_HOSTS);

  /** Platform id for a music link ("link" for smart links), or null. */
  function platformOf(raw) {
    let host;
    try {
      host = new URL(raw).hostname.toLowerCase();
    } catch {
      return null;
    }
    // Longest match first, so music.youtube.com wins over youtube.com.
    const match = HOSTS.filter((h) => host === h || host.endsWith(`.${h}`)).sort((a, b) => b.length - a.length)[0];
    return match ? MUSIC_HOSTS[match] : null;
  }

  function isMusicUrl(raw) {
    return platformOf(raw) !== null;
  }

  // Links written out as plain text, e.g. the YouTube card's "youtu.be/jYJImcoL_dw?is=Z34c…".
  // Matches up to the first space or "…", so truncated links still keep their ids.
  const LINK_IN_TEXT = new RegExp(
    `(?<![\\w.-])(?:https?://)?(?:[a-z0-9-]+\\.)*(?:${HOSTS.map((h) => h.replace(/\./g, "\\.")).join("|")})/[^\\s…]*`,
    "gi",
  );
  // Desktop-app share links: spotify:track:4uLU6hMCjMI75M1A2tKUQC
  const SPOTIFY_URI = /\bspotify:(track|album|playlist|artist|episode|show):([A-Za-z0-9]{22})\b/g;

  /** Music links written as text in a post, including ones X shortened with "…". */
  function musicUrlsInText(text) {
    const urls = [];
    for (const m of (text ?? "").matchAll(LINK_IN_TEXT)) {
      const url = toUrl(m[0].replace(/[.,;:!?)\]]+$/, ""));
      if (url && isMusicUrl(url)) urls.push(url);
    }
    for (const m of (text ?? "").matchAll(SPOTIFY_URI)) urls.push(`https://open.spotify.com/${m[1]}/${m[2]}`);
    return urls;
  }

  /** Drop links that are a truncated copy of a longer link from the same post. */
  function dropTruncated(urls) {
    const unique = [...new Set(urls)];
    return unique.filter((u) => !unique.some((other) => other !== u && other.startsWith(u)));
  }

  /** "open.spotify.com/track/…" or "https://…" → absolute https URL, or null. */
  function toUrl(text) {
    const t = (text ?? "").trim();
    // X truncates long links with an ellipsis, so the visible text is not a full URL.
    if (!t || /\s/.test(t) || t.endsWith("…")) return null;
    const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    try {
      return new URL(withScheme).href;
    } catch {
      return null;
    }
  }

  /** The logged-in account's numeric id, from X's `twid` cookie ("u%3D12345"). */
  function accountIdFromTwid(value) {
    let decoded;
    try {
      decoded = decodeURIComponent(value ?? "");
    } catch {
      return null;
    }
    const m = /u=(\d{1,25})/.exec(decoded);
    return m ? m[1] : null;
  }

  /* ------------------------------------------------------------------------ */
  /*                        X GraphQL timeline responses                       */
  /* ------------------------------------------------------------------------ */

  const isObj = (v) => v !== null && typeof v === "object";

  /** "Wed Oct 10 20:19:24 +0000 2018" → ISO string, or null. */
  function isoFromTwitterDate(value) {
    const d = new Date(value ?? "");
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  /**
   * Every original post by `accountId` in an X GraphQL response, with its full
   * (un-shortened) links. Retweets are skipped; quoted posts by others are
   * separate objects and are skipped by the author check. Also returns the
   * account's public profile when the response includes it.
   */
  function tweetsFromGraphql(json, accountId) {
    const tweets = [];
    let profile = null;
    const visited = new Set();

    function readUser(u) {
      if (!isObj(u) || u.rest_id !== accountId || profile) return;
      const legacy = isObj(u.legacy) ? u.legacy : {};
      const core = isObj(u.core) ? u.core : {};
      profile = {
        username: core.screen_name ?? legacy.screen_name ?? null,
        displayName: core.name ?? legacy.name ?? null,
        bio: legacy.description ?? u.profile_bio?.description ?? null,
        avatarUrl: u.avatar?.image_url ?? legacy.profile_image_url_https ?? null,
      };
    }

    function readTweet(t) {
      const legacy = t.legacy;
      const id = t.rest_id ?? legacy.id_str;
      if (legacy.user_id_str !== accountId || !/^\d{1,25}$/.test(id ?? "")) return;
      if (legacy.retweeted_status_result || /^RT @/.test(legacy.full_text ?? "")) return;
      const tweetedAt = isoFromTwitterDate(legacy.created_at);
      if (!tweetedAt) return;

      const note = t.note_tweet?.note_tweet_results?.result;
      const text = note?.text ?? legacy.full_text ?? "";
      const entityUrls = [...(legacy.entities?.urls ?? []), ...(note?.entity_set?.urls ?? [])];
      const urls = entityUrls.map((u) => u?.expanded_url).filter((u) => typeof u === "string");
      tweets.push({ tweetId: id, tweetedAt, text, urls: [...urls, ...musicUrlsInText(text)] });
    }

    function walk(node, depth) {
      if (!isObj(node) || depth > 60 || visited.has(node)) return;
      visited.add(node);
      if (Array.isArray(node)) {
        for (const child of node) walk(child, depth + 1);
        return;
      }
      if (node.__typename === "User") readUser(node);
      if (isObj(node.legacy) && typeof node.legacy.created_at === "string" && "full_text" in node.legacy) readTweet(node);
      for (const key in node) walk(node[key], depth + 1);
    }

    walk(json, 0);
    return { tweets, profile };
  }

  /* ------------------------------------------------------------------------ */
  /*                             Search windowing                              */
  /* ------------------------------------------------------------------------ */

  /** ISO time → "YYYY-MM-DD" (UTC). */
  function dayOf(iso) {
    return new Date(iso).toISOString().slice(0, 10);
  }

  function addDays(day, n) {
    const d = new Date(`${day}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  /**
   * Latest-first search of the account's posts that contain links. `until` is
   * exclusive and `since` inclusive, both "YYYY-MM-DD".
   */
  function searchUrl(handle, { until = null, since = null } = {}) {
    const q = [`from:${handle}`, "filter:links", since && `since:${since}`, until && `until:${until}`].filter(Boolean).join(" ");
    return `${X_ORIGIN}/search?q=${encodeURIComponent(q)}&src=typed_query&f=live`;
  }

  /**
   * Upper bound for the next search window once a window runs dry.
   * X stops serving a search after a few hundred results, so we restart it
   * from the oldest day reached (re-reading that day; duplicates are skipped).
   * If that wouldn't move the window back, skip to the day before.
   */
  function nextUntil(oldestIso, prevUntil) {
    const oldest = dayOf(oldestIso);
    const next = addDays(oldest, 1);
    if (!prevUntil || next < prevUntil) return next;
    return oldest < prevUntil ? oldest : addDays(prevUntil, -1);
  }

  /* ------------------------------------------------------------------------ */
  /*                               Scan state                                  */
  /* ------------------------------------------------------------------------ */

  /** A fresh scan for the account. */
  function newScan(accountId) {
    return {
      v: 1,
      accountId,
      handle: null,
      profile: null,
      status: "idle", // idle | running | cooldown | paused | done | error
      mode: "all", // all: back through history · new: only posts since the newest one we have
      message: null,
      runId: null,
      tabId: null,
      windowId: null,
      until: null,
      since: null,
      newest: null,
      oldest: null,
      complete: false,
      scanned: 0,
      seen: [],
      items: [],
      published: 0,
      resumeAt: null,
      updatedAt: null,
    };
  }

  /** Merge newly found posts into the scan. Returns the number of new songs. */
  function mergeTweets(scan, tweets) {
    const seen = new Set(scan.seen);
    const byUrl = new Map(scan.items.map((i) => [i.url, i]));
    const before = byUrl.size;
    for (const t of tweets) {
      if (seen.has(t.tweetId)) continue;
      seen.add(t.tweetId);
      scan.scanned++;
      if (!scan.newest || t.tweetedAt > scan.newest) scan.newest = t.tweetedAt;
      if (!scan.oldest || t.tweetedAt < scan.oldest) scan.oldest = t.tweetedAt;
      for (const url of dropTruncated(t.urls.filter(isMusicUrl))) {
        if (url.length > 2048) continue;
        const prev = byUrl.get(url);
        // Keep the earliest post that shared each link.
        if (!prev || t.tweetedAt < prev.tweetedAt) {
          byUrl.set(url, { url, tweetId: t.tweetId, tweetedAt: t.tweetedAt, text: (t.text ?? "").slice(0, 500) });
        }
      }
    }
    scan.seen = [...seen];
    scan.items = [...byUrl.values()];
    return byUrl.size - before;
  }

  /** What the popup and the site show: no post text, no ids. */
  function summarize(scan) {
    if (!scan) return null;
    const platforms = {};
    for (const item of scan.items) {
      const p = platformOf(item.url) ?? "link";
      platforms[p] = (platforms[p] ?? 0) + 1;
    }
    const recent = [...scan.items]
      .sort((a, b) => (a.tweetedAt < b.tweetedAt ? 1 : -1))
      .slice(0, 5)
      .map((i) => ({ url: i.url, tweetedAt: i.tweetedAt }));
    return {
      handle: scan.handle,
      status: scan.status,
      mode: scan.mode,
      message: scan.message,
      scanned: scan.scanned,
      songs: scan.items.length,
      unpublished: Math.max(0, scan.items.length - scan.published),
      newest: scan.newest,
      oldest: scan.oldest,
      complete: scan.complete,
      resumeAt: scan.resumeAt,
      updatedAt: scan.updatedAt,
      platforms,
      recent,
    };
  }

  root.FeedbeatLib = {
    SITE_URL,
    SITE_ORIGINS,
    X_ORIGIN,
    platformOf,
    isMusicUrl,
    musicUrlsInText,
    dropTruncated,
    toUrl,
    accountIdFromTwid,
    tweetsFromGraphql,
    dayOf,
    addDays,
    searchUrl,
    nextUntil,
    newScan,
    mergeTweets,
    summarize,
  };
})(globalThis);
