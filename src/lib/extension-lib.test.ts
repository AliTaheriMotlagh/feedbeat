import { describe, expect, it } from "vitest";
import manifest from "../../extension/manifest.json";
// Classic script: importing it runs it and attaches the helpers to globalThis.
import "../../extension/lib.js";

interface Tweet {
  tweetId: string;
  tweetedAt: string;
  text: string;
  urls: string[];
  pinned?: boolean;
}
interface Scan {
  handle: string | null;
  mode: string;
  phase: string;
  until: string | null;
  since: string | null;
  scanned: number;
  newest: string | null;
  oldest: string | null;
  seen: string[];
  items: { url: string; tweetId: string; tweetedAt: string; text: string }[];
  published: number;
  status: string;
}
interface Lib {
  matchesPattern(url: string, pattern: string): boolean;
  isSiteUrl(url: string, patterns?: string[]): boolean;
  defaultSiteUrl(patterns?: string[]): string | null;
  isMusicUrl(raw: string): boolean;
  platformOf(raw: string): string | null;
  toUrl(text: string | null | undefined): string | null;
  accountIdFromTwid(value: string | undefined): string | null;
  musicUrlsInText(text: string | null | undefined): string[];
  dropTruncated(urls: string[]): string[];
  tweetsFromGraphql(json: unknown, accountId: string): { tweets: Tweet[]; profile: Record<string, string | null> | null };
  hasNoPosts(json: unknown): boolean;
  continueHistory(scan: Scan): Scan;
  searchUrl(handle: string, opts?: { until?: string | null; since?: string | null }): string;
  nextUntil(oldestIso: string, prevUntil: string | null): string;
  scanUrl(scan: Scan): string;
  newScan(accountId: string): Scan;
  mergeTweets(scan: Scan, tweets: Tweet[]): number;
  summarize(scan: Scan | null): { songs: number; unpublished: number; platforms: Record<string, number> } | null;
}
const lib = (globalThis as unknown as { FeedbeatLib: Lib }).FeedbeatLib;

describe("extension match patterns", () => {
  it("matches the path and query like the browser does", () => {
    const p = "https://feedbeat.example/import/extension*";
    expect(lib.matchesPattern("https://feedbeat.example/import/extension", p)).toBe(true);
    expect(lib.matchesPattern("https://feedbeat.example/import/extension?publish", p)).toBe(true);
    expect(lib.matchesPattern("https://feedbeat.example/import", p)).toBe(false);
    expect(lib.matchesPattern("https://feedbeat.example/u/me/import/extension", p)).toBe(false);
  });

  it("takes the scheme and host literally, so lookalikes don't match", () => {
    const p = "https://feedbeat.example/import/extension*";
    expect(lib.matchesPattern("http://feedbeat.example/import/extension", p)).toBe(false);
    expect(lib.matchesPattern("https://feedbeat.example.evil.net/import/extension", p)).toBe(false);
    expect(lib.matchesPattern("https://evilfeedbeat.example/import/extension", p)).toBe(false);
    expect(lib.matchesPattern("not a url", p)).toBe(false);
  });

  it("matches every port unless the pattern names one", () => {
    const any = "http://localhost/import/extension*";
    expect(lib.matchesPattern("http://localhost:3000/import/extension", any)).toBe(true);
    expect(lib.matchesPattern("http://localhost:3456/import/extension", any)).toBe(true);
    expect(lib.matchesPattern("http://localhost/import/extension", any)).toBe(true);
    const pinned = "http://localhost:3000/import/extension*";
    expect(lib.matchesPattern("http://localhost:3000/import/extension", pinned)).toBe(true);
    expect(lib.matchesPattern("http://localhost:3456/import/extension", pinned)).toBe(false);
  });

  it("supports *.domain hosts", () => {
    const p = "https://*.example.com/*";
    expect(lib.matchesPattern("https://a.example.com/x", p)).toBe(true);
    expect(lib.matchesPattern("https://example.com/x", p)).toBe(true);
    expect(lib.matchesPattern("https://badexample.com/x", p)).toBe(false);
  });
});

describe("extension site list (manifest.json)", () => {
  const bridge = manifest.content_scripts.find((cs) => cs.js.includes("bridge.js"))!;
  const patterns = bridge.matches;

  // These two broke the extension before: it only knew a renamed Vercel domain and localhost:3000.
  it("runs the bridge on the production site", () => {
    expect(lib.isSiteUrl("https://feedbeat-free.vercel.app/import/extension?publish", patterns)).toBe(true);
  });

  it("runs the bridge on a dev server whatever port it ends up on", () => {
    for (const port of [3000, 3001, 3456]) {
      expect(lib.isSiteUrl(`http://localhost:${port}/import/extension`, patterns)).toBe(true);
      expect(lib.isSiteUrl(`http://127.0.0.1:${port}/import/extension`, patterns)).toBe(true);
    }
  });

  it("stays off every other page and site", () => {
    expect(lib.isSiteUrl("https://feedbeat-free.vercel.app/import", patterns)).toBe(false);
    expect(lib.isSiteUrl("https://feedbeat-free.vercel.app.evil.net/import/extension", patterns)).toBe(false);
    expect(lib.isSiteUrl("https://x.com/import/extension", patterns)).toBe(false);
    expect(lib.isSiteUrl("chrome-extension://abc/popup.html", patterns)).toBe(false);
  });

  it("sends people to the production site when nothing says otherwise", () => {
    expect(lib.defaultSiteUrl(patterns)).toBe("https://feedbeat-free.vercel.app");
  });

  it("lets the extension host-access every site it runs on", () => {
    for (const pattern of patterns) {
      const origin = pattern.replace(/\/import\/extension\*$/, "");
      expect(manifest.host_permissions).toContain(`${origin}/*`);
    }
  });
});

describe("extension isMusicUrl", () => {
  it("accepts music hosts and their subdomains", () => {
    expect(lib.isMusicUrl("https://open.spotify.com/track/abc")).toBe(true);
    expect(lib.isMusicUrl("https://music.youtube.com/watch?v=x")).toBe(true);
    expect(lib.isMusicUrl("https://www.youtube.com/watch?v=x")).toBe(true);
  });

  it("rejects lookalike and unrelated hosts", () => {
    expect(lib.isMusicUrl("https://example.com/open.spotify.com/track/abc")).toBe(false);
    expect(lib.isMusicUrl("https://spotify.com.evil.net/track/abc")).toBe(false);
    expect(lib.isMusicUrl("not a url")).toBe(false);
  });
});

describe("extension toUrl", () => {
  it("adds https to bare hosts", () => {
    expect(lib.toUrl("open.spotify.com/track/abc")).toBe("https://open.spotify.com/track/abc");
  });

  it("drops truncated, empty and multi-word text", () => {
    expect(lib.toUrl("open.spotify.com/track/abc…")).toBeNull();
    expect(lib.toUrl("")).toBeNull();
    expect(lib.toUrl("two words")).toBeNull();
    expect(lib.toUrl(null)).toBeNull();
  });
});

describe("extension accountIdFromTwid", () => {
  it("reads the numeric id from the encoded cookie", () => {
    expect(lib.accountIdFromTwid("u%3D1234567")).toBe("1234567");
    expect(lib.accountIdFromTwid("u=42")).toBe("42");
  });

  it("returns null when the cookie is missing or malformed", () => {
    expect(lib.accountIdFromTwid("junk")).toBeNull();
    expect(lib.accountIdFromTwid(undefined)).toBeNull();
    expect(lib.accountIdFromTwid("%E0%A4%A")).toBeNull();
  });
});

describe("extension musicUrlsInText", () => {
  it("finds the link in a default YouTube share message", () => {
    const text = "youtobe\nBaby Keem - Highway 95 pt. 2 (Official Audio) https://youtu.be/jYJImcoL_dw?is=Z34cfm7OvEJeGQx7 via \n@YouTube";
    expect(lib.musicUrlsInText(text)).toEqual(["https://youtu.be/jYJImcoL_dw?is=Z34cfm7OvEJeGQx7"]);
  });

  it("keeps the id of a link X truncated with an ellipsis", () => {
    expect(lib.musicUrlsInText("Song youtu.be/jYJImcoL_dw?is=Z34c…")).toEqual(["https://youtu.be/jYJImcoL_dw?is=Z34c"]);
  });

  it("ignores lookalike hosts and trailing punctuation is not part of the link", () => {
    expect(lib.musicUrlsInText("notyoutu.be/jYJImcoL_dw")).toEqual([]);
    expect(lib.musicUrlsInText("listen https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC.")).toEqual([
      "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
    ]);
  });
});

describe("extension link detection", () => {
  it("knows the newer platforms and smart links", () => {
    expect(lib.platformOf("https://audiomack.com/burnaboy/song/last-last")).toBe("audiomack");
    expect(lib.platformOf("https://www.mixcloud.com/user/mix/")).toBe("mixcloud");
    expect(lib.platformOf("https://music.youtube.com/watch?v=x")).toBe("youtube");
    expect(lib.platformOf("https://geo.music.apple.com/us/album/x/1")).toBe("apple");
    expect(lib.platformOf("https://umg.lnk.to/release")).toBe("link");
    expect(lib.platformOf("https://example.com")).toBeNull();
  });

  it("reads spotify: URIs written in a post", () => {
    expect(lib.musicUrlsInText("now playing spotify:track:4uLU6hMCjMI75M1A2tKUQC")).toEqual([
      "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
    ]);
  });

  it("drops a truncated copy when the full link is also known", () => {
    expect(lib.dropTruncated(["https://youtu.be/jYJImcoL_dw?is=Z34c", "https://youtu.be/jYJImcoL_dw?is=Z34cfm7OvEJeGQx7"])).toEqual([
      "https://youtu.be/jYJImcoL_dw?is=Z34cfm7OvEJeGQx7",
    ]);
  });
});

describe("extension tweetsFromGraphql", () => {
  const me = "42";
  const user = (id: string, screenName: string) => ({
    __typename: "User",
    rest_id: id,
    core: { screen_name: screenName, name: "Me" },
    legacy: { description: "bio", profile_image_url_https: "https://pbs.twimg.com/a_normal.jpg", created_at: "Mon Jan 01 00:00:00 +0000 2018" },
  });
  const tweet = (id: string, userId: string, url: string, extra: Record<string, unknown> = {}) => ({
    __typename: "Tweet",
    rest_id: id,
    core: { user_results: { result: user(userId, userId === me ? "me" : "other") } },
    legacy: {
      id_str: id,
      user_id_str: userId,
      created_at: "Wed Oct 10 20:19:24 +0000 2018",
      full_text: `listen https://t.co/abc`,
      entities: { urls: [{ url: "https://t.co/abc", expanded_url: url }] },
      ...extra,
    },
  });
  const response = (...tweets: unknown[]) => ({
    data: {
      search_by_raw_query: {
        search_timeline: {
          timeline: {
            instructions: [
              { type: "TimelineAddEntries", entries: tweets.map((t, i) => ({ entryId: `tweet-${i}`, content: { itemContent: { tweet_results: { result: t } } } })) },
            ],
          },
        },
      },
    },
  });

  it("returns the account's own posts with their full links", () => {
    const { tweets, profile } = lib.tweetsFromGraphql(response(tweet("1", me, "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC")), me);
    expect(tweets).toEqual([
      {
        tweetId: "1",
        tweetedAt: "2018-10-10T20:19:24.000Z",
        text: "listen https://t.co/abc",
        urls: ["https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"],
      },
    ]);
    expect(profile).toMatchObject({ username: "me", displayName: "Me", bio: "bio" });
  });

  it("skips other people's posts, quoted posts and retweets", () => {
    const quoted = tweet("2", "7", "https://youtu.be/dQw4w9WgXcQ");
    const quoting = tweet("3", me, "https://x.com/other/status/2", { quoted_status_result: { result: quoted } });
    const retweet = tweet("4", me, "https://youtu.be/dQw4w9WgXcQ", { retweeted_status_result: { result: quoted }, full_text: "RT @other: hi" });
    const ids = lib.tweetsFromGraphql(response(quoting, retweet, tweet("5", "7", "https://youtu.be/x")), me).tweets.map((t) => t.tweetId);
    expect(ids).toEqual(["3"]);
  });

  it("reads long posts from note_tweet", () => {
    const long = tweet("6", me, "https://youtu.be/dQw4w9WgXcQ", {});
    Object.assign(long, {
      note_tweet: { note_tweet_results: { result: { text: "long text", entity_set: { urls: [{ expanded_url: "https://soundcloud.com/a/b" }] } } } },
    });
    const [t] = lib.tweetsFromGraphql(response(long), me).tweets;
    expect(t.text).toBe("long text");
    expect(t.urls).toContain("https://soundcloud.com/a/b");
  });
});

describe("extension search windows", () => {
  it("builds a latest-first search of the account's link posts", () => {
    const url = new URL(lib.searchUrl("me", { until: "2021-03-04", since: "2020-01-01" }));
    expect(url.searchParams.get("q")).toBe("from:me filter:links since:2020-01-01 until:2021-03-04");
    expect(url.searchParams.get("f")).toBe("live");
  });

  it("restarts at the day after the oldest post reached", () => {
    expect(lib.nextUntil("2021-03-02T10:00:00.000Z", null)).toBe("2021-03-03");
    expect(lib.nextUntil("2021-03-02T10:00:00.000Z", "2021-05-01")).toBe("2021-03-03");
  });

  it("always moves the window back, even when one day fills a whole search", () => {
    expect(lib.nextUntil("2021-03-02T10:00:00.000Z", "2021-03-03")).toBe("2021-03-02");
    expect(lib.nextUntil("2021-03-03T10:00:00.000Z", "2021-03-03")).toBe("2021-03-02");
  });
});

describe("extension scan pages", () => {
  it("reads the profile first, then searches further back", () => {
    const scan = Object.assign(lib.newScan("42"), { handle: "me" });
    expect(lib.scanUrl(scan)).toBe("https://x.com/me/with_replies");
    Object.assign(scan, { phase: "search", until: "2021-03-04" });
    expect(new URL(lib.scanUrl(scan)).searchParams.get("q")).toBe("from:me filter:links until:2021-03-04");
  });

  it("looks for new posts on the profile", () => {
    const scan = Object.assign(lib.newScan("42"), { handle: "me", mode: "new", phase: "search", since: "2021-03-04" });
    expect(lib.scanUrl(scan)).toBe("https://x.com/me/with_replies");
  });

  it("marks the pinned post of a profile timeline", () => {
    const tweet = (id: string) => ({
      __typename: "Tweet",
      rest_id: id,
      legacy: { user_id_str: "42", created_at: "Wed Oct 10 20:19:24 +0000 2018", full_text: "hi", entities: { urls: [] } },
    });
    const json = {
      instructions: [
        { type: "TimelinePinEntry", entry: { content: { itemContent: { tweet_results: { result: tweet("1") } } } } },
        { type: "TimelineAddEntries", entries: [{ content: { itemContent: { tweet_results: { result: tweet("2") } } } }] },
      ],
    };
    const { tweets } = lib.tweetsFromGraphql(json, "42");
    expect(tweets.map((t) => [t.tweetId, !!t.pinned])).toEqual([
      ["1", true],
      ["2", false],
    ]);
  });
});

describe("extension continueHistory", () => {
  const scan = (over: Partial<Scan>) => Object.assign(lib.newScan("42"), { handle: "me" }, over);

  // Starting the profile over after every rate-limit pause re-read the same pages each time and never got any further.
  it("carries on from the oldest day reached instead of reading the profile again", () => {
    const s = lib.continueHistory(scan({ phase: "profile", oldest: "2026-05-05T10:00:00.000Z" }));
    expect([s.mode, s.phase, s.since, s.until]).toEqual(["all", "search", null, "2026-05-06"]);
    expect(new URL(lib.scanUrl(s)).searchParams.get("q")).toBe("from:me filter:links until:2026-05-06");
  });

  it("keeps reading the profile when nothing has been read yet", () => {
    const s = lib.continueHistory(scan({ phase: "profile", oldest: null }));
    expect([s.phase, s.until]).toEqual(["profile", null]);
    expect(lib.scanUrl(s)).toBe("https://x.com/me/with_replies");
  });

  it("resumes a search from the oldest post reached, not from the window it started in", () => {
    const s = lib.continueHistory(scan({ phase: "search", until: "2026-09-01", oldest: "2026-07-15T00:00:00.000Z" }));
    expect(s.until).toBe("2026-07-16");
  });

  it("drops a leftover lower bound", () => {
    expect(lib.continueHistory(scan({ since: "2026-01-01", oldest: "2026-07-15T00:00:00.000Z" })).since).toBeNull();
  });
});

describe("extension hasNoPosts", () => {
  const page = (...entries: unknown[]) => ({ data: { timeline: { instructions: [{ type: "TimelineAddEntries", entries }] } } });
  const cursor = (type: string) => ({ entryId: `cursor-${type}`, content: { entryType: "TimelineTimelineCursor", cursorType: type, value: "abc" } });
  const item = (result: unknown) => ({ entryId: "tweet-1", content: { itemContent: { tweet_results: { result } } } });

  it("is true for the last page of a timeline: only cursors", () => {
    expect(lib.hasNoPosts(page(cursor("Top"), cursor("Bottom")))).toBe(true);
    expect(lib.hasNoPosts({})).toBe(true);
  });

  it("is false when a post is on the page, whoever wrote it", () => {
    expect(lib.hasNoPosts(page(item({ __typename: "Tweet", rest_id: "1", legacy: { user_id_str: "7" } }), cursor("Bottom")))).toBe(false);
  });

  it("counts wrapped and deleted posts as posts, so a page of them isn't taken for the end", () => {
    expect(lib.hasNoPosts(page(item({ __typename: "TweetWithVisibilityResults", tweet: { __typename: "Tweet" } })))).toBe(false);
    expect(lib.hasNoPosts(page(item({ __typename: "TweetTombstone" })))).toBe(false);
  });
});

describe("extension mergeTweets", () => {
  it("doesn't let an old pinned post move how far the scan got", () => {
    const scan = lib.newScan("42");
    lib.mergeTweets(scan, [
      { tweetId: "1", tweetedAt: "2015-01-01T00:00:00.000Z", text: "", urls: [], pinned: true },
      { tweetId: "2", tweetedAt: "2024-01-01T00:00:00.000Z", text: "", urls: [] },
    ]);
    expect([scan.oldest, scan.newest, scan.scanned]).toEqual(["2024-01-01T00:00:00.000Z", "2024-01-01T00:00:00.000Z", 2]);
  });

  it("counts each post once and keeps the earliest post per link", () => {
    const scan = lib.newScan("42");
    const song = "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC";
    expect(lib.mergeTweets(scan, [{ tweetId: "2", tweetedAt: "2021-02-01T00:00:00.000Z", text: "b", urls: [song, "https://example.com"] }])).toBe(1);
    expect(lib.mergeTweets(scan, [{ tweetId: "1", tweetedAt: "2021-01-01T00:00:00.000Z", text: "a", urls: [song] }])).toBe(0);
    lib.mergeTweets(scan, [{ tweetId: "1", tweetedAt: "2021-01-01T00:00:00.000Z", text: "a", urls: [song] }]);
    expect(scan.scanned).toBe(2);
    expect(scan.items).toEqual([{ url: song, tweetId: "1", tweetedAt: "2021-01-01T00:00:00.000Z", text: "a" }]);
    expect([scan.oldest, scan.newest]).toEqual(["2021-01-01T00:00:00.000Z", "2021-02-01T00:00:00.000Z"]);
  });

  it("summarizes without post text and tracks unpublished songs", () => {
    const scan = lib.newScan("42");
    lib.mergeTweets(scan, [{ tweetId: "1", tweetedAt: "2021-01-01T00:00:00.000Z", text: "secret", urls: ["https://youtu.be/dQw4w9WgXcQ", "https://ffm.to/x"] }]);
    scan.published = 1;
    const summary = lib.summarize(scan)!;
    expect(summary).toMatchObject({ songs: 2, unpublished: 1, platforms: { youtube: 1, link: 1 } });
    expect(JSON.stringify(summary)).not.toContain("secret");
  });
});
