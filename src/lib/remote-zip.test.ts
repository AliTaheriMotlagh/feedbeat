import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_RANGE_BYTES } from "./archive-url";
import { openRemoteZip } from "./remote-zip";
import { extractAccount, isNeededArchiveFile, parseYtdFile } from "./x-archive";
import { listZipEntries, readZipEntryText } from "./zip-reader";

/** Stand-in for /api/archive-proxy: serves byte ranges of a local file. */
function serve(bytes: Uint8Array) {
  const requests: string[] = [];
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    const range = new Headers(init.headers).get("range")!;
    requests.push(range);
    const [, a, b] = /^bytes=(\d+)-(\d+)$/.exec(range)!.map(Number);
    expect(b - a + 1).toBeLessThanOrEqual(MAX_RANGE_BYTES);
    const end = Math.min(b, bytes.length - 1);
    return new Response(bytes.slice(a, end + 1), { status: 206, headers: { "Content-Range": `bytes ${a}-${end}/${bytes.length}` } });
  });
  return requests;
}

afterEach(() => vi.unstubAllGlobals());

describe("openRemoteZip", () => {
  it("reads an archive through byte ranges", async () => {
    const bytes = new Uint8Array(await readFile(new URL("./__fixtures__/archive-zip64.zip", import.meta.url)));
    const requests = serve(bytes);
    const progress: number[] = [];

    const zip = await openRemoteZip("https://example.com/a.zip", (n) => progress.push(n));
    expect(zip.size).toBe(bytes.length);
    const entries = await listZipEntries(zip);
    const account = entries.find((e) => isNeededArchiveFile(e.name) === "account")!;
    expect(extractAccount(parseYtdFile(await readZipEntryText(zip, account)))).toMatchObject({ username: "FixtureDJ" });
    expect(requests[0]).toBe("bytes=0-0");
    expect(progress.at(-1)).toBeGreaterThan(0);
  });

  it("splits large reads into proxy-sized ranges", async () => {
    const bytes = new Uint8Array(MAX_RANGE_BYTES * 2 + 10).map((_, i) => i % 251);
    const requests = serve(bytes);
    const zip = await openRemoteZip("https://example.com/big.zip");
    const blob = await zip.slice(5, bytes.length);
    expect(Buffer.compare(Buffer.from(await blob.arrayBuffer()), Buffer.from(bytes.subarray(5)))).toBe(0);
    expect(requests.slice(1)).toHaveLength(3);
  });

  it("surfaces proxy errors", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ error: "That link opens a web page, not the file." }, { status: 422 }));
    await expect(openRemoteZip("https://example.com/a.zip")).rejects.toThrow(/web page/);
  });
});
