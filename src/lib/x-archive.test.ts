import { describe, expect, it } from "vitest";
import { extractAccount, extractMusicLinks, extractProfile, isNeededArchiveFile, parseTwitterDate, parseYtdFile } from "./x-archive";

const tweetsFile = `window.YTD.tweets.part0 = [
  { "tweet": { "id_str": "100", "created_at": "Wed Oct 10 20:19:24 +0000 2018", "full_text": "old share https://t.co/a",
    "entities": { "urls": [ { "url": "https://t.co/a", "expanded_url": "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=x" } ] } } },
  { "tweet": { "id_str": "200", "created_at": "Fri Jan 05 08:00:00 +0000 2024", "full_text": "again + video",
    "entities": { "urls": [
      { "url": "https://t.co/b", "expanded_url": "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC" },
      { "url": "https://t.co/c", "expanded_url": "https://youtu.be/dQw4w9WgXcQ" },
      { "url": "https://t.co/d", "expanded_url": "https://spotify.link/abc" },
      { "url": "https://t.co/e", "expanded_url": "https://example.com/not-music" }
    ] } } },
  { "tweet": { "id_str": "300", "created_at": "Fri Jan 05 09:00:00 +0000 2024", "full_text": "no links", "entities": { "urls": [] } } }
]`;

describe("x archive", () => {
  it("recognizes the data files we need", () => {
    expect(isNeededArchiveFile("data/tweets.js")).toBe("tweets");
    expect(isNeededArchiveFile("twitter-2024/data/tweets-part2.js")).toBe("tweets");
    expect(isNeededArchiveFile("data/tweet.js")).toBe("tweets");
    expect(isNeededArchiveFile("data/account.js")).toBe("account");
    expect(isNeededArchiveFile("data/like.js")).toBeNull();
    expect(isNeededArchiveFile("data/tweets_media/x.jpg")).toBeNull();
  });

  it("parses twitter dates without relying on Date parsing quirks", () => {
    expect(parseTwitterDate("Wed Oct 10 20:19:24 +0000 2018")).toBe("2018-10-10T20:19:24.000Z");
    expect(parseTwitterDate("garbage")).toBeNull();
  });

  it("extracts de-duplicated music links, keeping the earliest share", () => {
    const scan = extractMusicLinks(parseYtdFile(tweetsFile));
    expect(scan.tweetsScanned).toBe(3);
    expect(scan.byPlatform).toEqual({ spotify: 1, youtube: 1 });
    expect(scan.unresolved).toBe(1);
    const spotify = scan.items.find((i) => i.url.includes("spotify.com"));
    expect(spotify).toMatchObject({ tweetId: "100", url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC" });
  });

  it("reads account and profile but never private fields", () => {
    const account = extractAccount(
      parseYtdFile(`window.YTD.account.part0 = [{"account":{"email":"me@x.com","username":"Dj_Test","accountId":"123","accountDisplayName":"DJ Test"}}]`),
    );
    expect(account).toEqual({ accountId: "123", username: "Dj_Test", displayName: "DJ Test" });
    const profile = extractProfile(
      parseYtdFile(`window.YTD.profile.part0 = [{"profile":{"description":{"bio":"beats"},"avatarMediaUrl":"https://pbs.twimg.com/profile_images/1/a.jpg"}}]`),
    );
    expect(profile).toEqual({ bio: "beats", avatarUrl: "https://pbs.twimg.com/profile_images/1/a.jpg" });
  });

  it("rejects non-archive files", () => {
    expect(() => parseYtdFile("hello")).toThrow();
  });
});
