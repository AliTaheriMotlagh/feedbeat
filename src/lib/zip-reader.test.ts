import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { extractAccount, extractMusicLinks, isNeededArchiveFile, parseYtdFile } from "./x-archive";
import { listZipEntries, readZipEntryText } from "./zip-reader";

async function load(name: string) {
  return new Blob([await readFile(new URL(`./__fixtures__/${name}`, import.meta.url))]);
}

describe.each(["archive.zip", "archive-zip64.zip"])("zip reader (%s)", (fixture) => {
  it("lists entries and reads deflated archive data end-to-end", async () => {
    const blob = await load(fixture);
    const entries = await listZipEntries(blob);
    expect(entries.map((e) => e.name)).toEqual(["Your archive.html", "data/tweets.js", "data/account.js"]);

    const tweets = entries.find((e) => isNeededArchiveFile(e.name) === "tweets")!;
    const account = entries.find((e) => isNeededArchiveFile(e.name) === "account")!;
    const scan = extractMusicLinks(parseYtdFile(await readZipEntryText(blob, tweets)));
    expect(scan.byPlatform).toEqual({ spotify: 1, youtube: 1 });
    expect(extractAccount(parseYtdFile(await readZipEntryText(blob, account)))).toEqual({
      accountId: "987",
      username: "FixtureDJ",
      displayName: "Fixture DJ",
    });
  });
});

describe("zip reader errors", () => {
  it("rejects non-zip files", async () => {
    await expect(listZipEntries(new Blob(["not a zip"]))).rejects.toThrow(/zip/);
  });
});
