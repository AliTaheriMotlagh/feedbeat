import { describe, expect, it } from "vitest";
import { normalizeArchiveUrl } from "./archive-url";

describe("normalizeArchiveUrl", () => {
  it.each([
    ["https://example.com/archive.zip", "https://example.com/archive.zip"],
    ["  https://example.com/a.zip#frag ", "https://example.com/a.zip"],
    ["https://www.dropbox.com/s/abc123/twitter.zip?dl=0", "https://www.dropbox.com/s/abc123/twitter.zip?dl=1"],
    [
      "https://www.dropbox.com/scl/fi/xyz/twitter.zip?rlkey=k1&dl=0",
      "https://www.dropbox.com/scl/fi/xyz/twitter.zip?rlkey=k1&dl=1",
    ],
    [
      "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing",
      "https://drive.usercontent.google.com/download?id=1AbCdEfGhIjKlMnOp&export=download&confirm=t",
    ],
    [
      "https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp",
      "https://drive.usercontent.google.com/download?id=1AbCdEfGhIjKlMnOp&export=download&confirm=t",
    ],
  ])("%s", (input, expected) => {
    expect(normalizeArchiveUrl(input)).toBe(expected);
  });

  it.each(["not a url", "http://example.com/a.zip", "ftp://example.com/a.zip", "https://u:p@example.com/a.zip", "https://example.com:8080/a.zip"])(
    "rejects %s",
    (input) => {
      expect(() => normalizeArchiveUrl(input)).toThrow();
    },
  );
});
