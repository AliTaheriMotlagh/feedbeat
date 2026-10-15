import { MAX_RANGE_BYTES } from "./archive-url";
import type { ZipSource } from "./zip-reader";

/**
 * A `ZipSource` backed by a URL. Bytes come through our `/api/archive-proxy`
 * (most hosts don't allow cross-origin reads) in HTTP ranges, so only the zip
 * directory and the few data files we need are downloaded — never the media.
 */

const PARALLEL = 3;

async function fetchRange(url: string, start: number, endInclusive: number): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`/api/archive-proxy?url=${encodeURIComponent(url)}`, {
        headers: { Range: `bytes=${start}-${endInclusive}` },
        cache: "no-store",
      });
    } catch {
      if (attempt < 1) continue;
      throw new Error("Network error while downloading. Check your connection and retry.");
    }
    if (res.ok) return res;
    if (attempt < 1 && (res.status === 502 || res.status === 504)) continue;
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Couldn't download from that link.");
  }
}

/** Opens a remote .zip; `onBytes` reports the running total downloaded. */
export async function openRemoteZip(url: string, onBytes?: (loaded: number) => void): Promise<ZipSource> {
  // A one-byte probe tells us the file size (from Content-Range) and that ranges work.
  const probe = await fetchRange(url, 0, 0);
  await probe.arrayBuffer();
  const size = Number(/\/(\d+)$/.exec(probe.headers.get("content-range") ?? "")?.[1]);
  if (!Number.isSafeInteger(size) || size <= 0) throw new Error("Couldn't tell how big that file is.");

  let loaded = 0;
  return {
    size,
    async slice(start, end) {
      start = Math.max(0, start);
      end = Math.min(size, end);
      if (end <= start) return new Blob([]);

      const ranges: [number, number][] = [];
      for (let a = start; a < end; a += MAX_RANGE_BYTES) ranges.push([a, Math.min(end, a + MAX_RANGE_BYTES)]);

      const parts = new Array<Blob>(ranges.length);
      let next = 0;
      const worker = async () => {
        while (next < ranges.length) {
          const i = next++;
          const [a, b] = ranges[i];
          const part = await (await fetchRange(url, a, b - 1)).blob();
          if (part.size !== b - a) throw new Error("The download was cut short. Please retry.");
          parts[i] = part;
          loaded += part.size;
          onBytes?.(loaded);
        }
      };
      await Promise.all(Array.from({ length: Math.min(PARALLEL, ranges.length) }, worker));
      return new Blob(parts);
    },
  };
}
