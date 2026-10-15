import { describe, expect, it } from "vitest";
// Classic script: importing it runs it and attaches the helpers to globalThis.
import "../../extension/lib.js";

interface Lib {
  isMusicUrl(raw: string): boolean;
  toUrl(text: string | null | undefined): string | null;
  accountIdFromTwid(value: string | undefined): string | null;
  musicUrlsInText(text: string | null | undefined): string[];
}
const lib = (globalThis as unknown as { FeedbeatLib: Lib }).FeedbeatLib;

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
