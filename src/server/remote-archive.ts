import "server-only";
import { lookup } from "node:dns";
import type { IncomingMessage } from "node:http";
import { request } from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { Readable } from "node:stream";
import { MAX_RANGE_BYTES, normalizeArchiveUrl } from "@/lib/archive-url";

/**
 * Fetches one byte range of a user-supplied archive link for the browser.
 * The URL is attacker-controlled, so every hop is re-checked and every DNS
 * answer is vetted at connect time (no rebinding to internal addresses).
 */

export class RemoteArchiveError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 20_000;

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

export function isPublicAddress(address: string): boolean {
  // IPv4-mapped IPv6 (::ffff:a.b.c.d / ::ffff:7f00:1) → judge the IPv4 address.
  const mapped = /^::ffff:(?:(\d+\.\d+\.\d+\.\d+)|([\da-f]{1,4}):([\da-f]{1,4}))$/i.exec(address);
  if (mapped) {
    if (mapped[1]) return isPublicAddress(mapped[1]);
    const hi = parseInt(mapped[2], 16);
    const lo = parseInt(mapped[3], 16);
    return isPublicAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, "ipv4");
  if (family === 6) return !blocked.check(address, "ipv6");
  return false;
}

const blockedError = () => Object.assign(new Error("Blocked address"), { code: "EBLOCKED" });

/** DNS lookup that refuses to connect anywhere non-public. */
const safeLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "");
    if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address))) return callback(blockedError(), "");
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
};

function assertAllowed(url: URL) {
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new RemoteArchiveError("That link redirects somewhere we can't follow.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && !isPublicAddress(host)) throw new RemoteArchiveError("That link points to a private network address.");
}

function get(url: URL, range: string) {
  return new Promise<IncomingMessage>((resolve, reject) => {
    const req = request(
      url,
      {
        headers: { Range: range, "Accept-Encoding": "identity", "User-Agent": "Mozilla/5.0 (compatible; ArchiveImport/1.0)" },
        lookup: safeLookup,
        timeout: TIMEOUT_MS,
      },
      resolve,
    );
    req.on("timeout", () => req.destroy(new RemoteArchiveError("The link took too long to respond.", 504)));
    req.on("error", (err: NodeJS.ErrnoException) => {
      if (err instanceof RemoteArchiveError) return reject(err);
      if (err.code === "EBLOCKED") return reject(new RemoteArchiveError("That link points to a private network address."));
      if (err.code === "ENOTFOUND" || err.code === "EAI_AGAIN") return reject(new RemoteArchiveError("We couldn't find that website."));
      reject(new RemoteArchiveError("We couldn't reach that link.", 502));
    });
    req.end();
  });
}

/** Stream that errors instead of passing more than `max` bytes. */
function capped(res: IncomingMessage, max: number) {
  let seen = 0;
  return (Readable.toWeb(res) as ReadableStream<Uint8Array>).pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        seen += chunk.byteLength;
        if (seen > max) {
          res.destroy();
          controller.error(new Error("Range overflow"));
          return;
        }
        controller.enqueue(chunk);
      },
    }),
  );
}

/** Fetch bytes [start, end] (inclusive) of an archive link. */
export async function fetchArchiveRange(rawUrl: string, start: number, end: number) {
  if (!(Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && end >= start && end - start < MAX_RANGE_BYTES)) {
    throw new RemoteArchiveError("Invalid byte range.");
  }
  let url: URL;
  try {
    url = new URL(normalizeArchiveUrl(rawUrl));
  } catch (err) {
    throw new RemoteArchiveError(err instanceof Error ? err.message : "Invalid link.");
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertAllowed(url);
    const res = await get(url, `bytes=${start}-${end}`);
    const status = res.statusCode ?? 0;

    if (status >= 300 && status < 400 && res.headers.location) {
      res.resume();
      url = new URL(res.headers.location, url);
      continue;
    }

    if (status === 206) {
      const m = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(res.headers["content-range"] ?? "");
      if (!m || Number(m[1]) !== start || Number(m[2]) > end) {
        res.destroy();
        throw new RemoteArchiveError("That server answered with the wrong part of the file. Download the .zip and drop it here instead.", 422);
      }
      return { body: capped(res, end - start + 1), contentRange: m[0] };
    }

    res.destroy();
    if (status === 200) {
      const html = /text\/html/i.test(res.headers["content-type"] ?? "");
      throw new RemoteArchiveError(
        html
          ? "That link opens a web page, not the file. Use a direct download link (or make sure it's shared publicly)."
          : "That server doesn't support partial downloads, so we can't read just the parts we need. Download the .zip and drop it here instead.",
        422,
      );
    }
    if (status === 416) throw new RemoteArchiveError("That file is smaller than expected — is it the full archive?", 422);
    if (status === 401 || status === 403 || status === 404 || status === 410) {
      throw new RemoteArchiveError(`The link returned HTTP ${status}. Make sure it's shared publicly and hasn't expired.`, 422);
    }
    throw new RemoteArchiveError(`The link returned HTTP ${status}.`, 502);
  }
  throw new RemoteArchiveError("That link redirects too many times.", 422);
}
