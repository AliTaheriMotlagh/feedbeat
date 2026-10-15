import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { pickMusicLink } = await import("./metadata");

describe("pickMusicLink", () => {
  it("prefers Spotify songs over other services and artist pages", () => {
    const html = `
      <a href="https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg">Follow</a>
      <a href="https://music.apple.com/us/album/after-hours/1499378108?i=1499378615&amp;app=music">Apple</a>
      <script>{"url":"https:\\/\\/open.spotify.com\\/track\\/4uLU6hMCjMI75M1A2tKUQC?si=1"}</script>`;
    expect(pickMusicLink(html)).toBe("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC");
  });

  it("falls back to whatever service the page has", () => {
    expect(pickMusicLink(`<a href="https://audiomack.com/burnaboy/song/last-last">`)).toBe("https://audiomack.com/burnaboy/song/last-last");
    expect(pickMusicLink(`<a href="https://example.com">`)).toBeNull();
  });
});
