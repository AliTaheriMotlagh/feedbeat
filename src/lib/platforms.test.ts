import { describe, expect, it } from "vitest";
import { embedUrl, isShortLink, parseMusicUrl } from "./platforms";

describe("parseMusicUrl", () => {
  it.each([
    ["https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc", "spotify", "track", "track:4uLU6hMCjMI75M1A2tKUQC"],
    ["https://open.spotify.com/intl-de/album/1DFixLWuPkv3KT3TnV35m3", "spotify", "album", "album:1DFixLWuPkv3KT3TnV35m3"],
    ["https://open.spotify.com/user/spotify/playlist/37i9dQZF1DXcBWIGoYBM5M", "spotify", "playlist", "playlist:37i9dQZF1DXcBWIGoYBM5M"],
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42", "youtube", "video", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?si=xyz", "youtube", "video", "dQw4w9WgXcQ"],
    ["https://music.youtube.com/watch?v=dQw4w9WgXcQ&feature=share", "youtube", "video", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/shorts/dQw4w9WgXcQ", "youtube", "video", "dQw4w9WgXcQ"],
    ["https://music.apple.com/us/album/blinding-lights/1499378108?i=1499378615", "apple", "track", "song:1499378615"],
    ["https://music.apple.com/gb/album/after-hours/1499378108", "apple", "album", "album:1499378108"],
    ["https://soundcloud.com/flume/never-be-like-you", "soundcloud", "track", "flume/never-be-like-you"],
    ["https://soundcloud.com/flume/sets/skin", "soundcloud", "playlist", "flume/sets/skin"],
    ["https://www.deezer.com/fr/track/3135556", "deezer", "track", "track:3135556"],
    ["https://tidal.com/browse/track/77646169", "tidal", "track", "track:77646169"],
    ["https://listen.tidal.com/album/77646168/track/77646169", "tidal", "track", "track:77646169"],
    ["https://artist.bandcamp.com/album/Great-Record", "bandcamp", "album", "artist/album/great-record"],
    ["https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC", "spotify", "track", "track:4uLU6hMCjMI75M1A2tKUQC"],
    ["https://geo.music.apple.com/us/album/after-hours/1499378108?i=1499378615", "apple", "track", "song:1499378615"],
    ["https://audiomack.com/burnaboy/song/last-last", "audiomack", "track", "song:burnaboy/last-last"],
    ["https://audiomack.com/song/burnaboy/last-last", "audiomack", "track", "song:burnaboy/last-last"],
    ["https://audiomack.com/burnaboy/album/love-damini", "audiomack", "album", "album:burnaboy/love-damini"],
    ["https://www.mixcloud.com/Spartacus/party-time/", "mixcloud", "track", "spartacus/party-time"],
    ["https://m.mixcloud.com/Spartacus/party-time", "mixcloud", "track", "spartacus/party-time"],
    ["https://song.link/s/4uLU6hMCjMI75M1A2tKUQC", "spotify", "track", "track:4uLU6hMCjMI75M1A2tKUQC"],
    ["https://album.link/s/1DFixLWuPkv3KT3TnV35m3", "spotify", "album", "album:1DFixLWuPkv3KT3TnV35m3"],
    ["https://song.link/us/i/1499378615", "apple", "track", "song:1499378615"],
    ["https://song.link/y/dQw4w9WgXcQ", "youtube", "video", "dQw4w9WgXcQ"],
  ])("parses %s", (url, platform, kind, externalId) => {
    expect(parseMusicUrl(url)).toMatchObject({ platform, kind, externalId });
  });

  it.each([
    "https://x.com/someone/status/1",
    "https://www.youtube.com/@channel",
    "https://soundcloud.com/discover",
    "https://soundcloud.com/flume",
    "https://open.spotify.com/track/short",
    "https://audiomack.com/burnaboy",
    "https://www.mixcloud.com/Spartacus/",
    "https://www.mixcloud.com/discover/house/",
    "https://www.mixcloud.com/Spartacus/favorites/",
    "https://song.link/some-release",
    "javascript:alert(1)",
    "not a url",
  ])("ignores %s", (url) => {
    expect(parseMusicUrl(url)).toBeNull();
  });

  it("strips tracking params from canonical urls", () => {
    expect(parseMusicUrl("https://youtu.be/dQw4w9WgXcQ?si=xyz")?.url).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });
});

describe("isShortLink", () => {
  it("detects redirectors", () => {
    expect(isShortLink("https://spotify.link/abc")).toBe(true);
    expect(isShortLink("https://on.soundcloud.com/xyz")).toBe(true);
    expect(isShortLink("https://open.spotify.com/track/x")).toBe(false);
  });

  it("detects smart links, including label subdomains", () => {
    expect(isShortLink("https://umg.lnk.to/release")).toBe(true);
    expect(isShortLink("https://ffm.to/abc")).toBe(true);
    expect(isShortLink("https://song.link/some-release")).toBe(true);
    expect(isShortLink("https://notlnk.to/abc")).toBe(false);
  });
});

describe("embedUrl", () => {
  it("builds platform embeds", () => {
    const sp = parseMusicUrl("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC")!;
    expect(embedUrl(sp)).toContain("open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC");
    const yt = parseMusicUrl("https://youtu.be/dQw4w9WgXcQ")!;
    expect(embedUrl(yt)).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    const bc = parseMusicUrl("https://artist.bandcamp.com/track/song")!;
    expect(embedUrl(bc)).toBeNull();
  });
});
