/**
 * Tiny, dependency-free ZIP reader for the browser.
 *
 * Reads only the central directory and the entries you ask for, via
 * `Blob.slice`, so multi-GB X archives (full of media) open instantly without
 * loading them into memory. Supports ZIP64 and stored/deflated entries,
 * using the native `DecompressionStream`.
 */

export interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  size: number;
  localHeaderOffset: number;
  encrypted: boolean;
}

const SIG_EOCD = 0x06054b50;
const SIG_ZIP64_LOCATOR = 0x07064b50;
const SIG_ZIP64_EOCD = 0x06064b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;
const MAX_U32 = 0xffffffff;

async function view(blob: Blob, start: number, end: number) {
  return new DataView(await blob.slice(start, end).arrayBuffer());
}

const u64 = (dv: DataView, off: number) => Number(dv.getBigUint64(off, true));

export async function listZipEntries(blob: Blob): Promise<ZipEntry[]> {
  // 1. Find the End Of Central Directory record (22 bytes + up to 64 KiB comment).
  const tailStart = Math.max(0, blob.size - (22 + 0xffff));
  const tail = await view(blob, tailStart, blob.size);
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error("This doesn't look like a .zip file.");

  let count = tail.getUint16(eocd + 10, true);
  let cdSize = tail.getUint32(eocd + 12, true);
  let cdOffset = tail.getUint32(eocd + 16, true);

  // 2. ZIP64: archives over 4 GB or 65k files.
  if (eocd >= 20 && tail.getUint32(eocd - 20, true) === SIG_ZIP64_LOCATOR) {
    const recOffset = u64(tail, eocd - 20 + 8);
    const rec = await view(blob, recOffset, recOffset + 56);
    if (rec.getUint32(0, true) === SIG_ZIP64_EOCD) {
      count = u64(rec, 32);
      cdSize = u64(rec, 40);
      cdOffset = u64(rec, 48);
    }
  }

  // 3. Walk the central directory.
  const cd = await view(blob, cdOffset, cdOffset + cdSize);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  let p = 0;
  for (let n = 0; n < count && p + 46 <= cd.byteLength; n++) {
    if (cd.getUint32(p, true) !== SIG_CENTRAL) break;
    const flags = cd.getUint16(p + 8, true);
    const method = cd.getUint16(p + 10, true);
    let compressedSize = cd.getUint32(p + 20, true);
    let size = cd.getUint32(p + 24, true);
    const nameLen = cd.getUint16(p + 28, true);
    const extraLen = cd.getUint16(p + 30, true);
    const commentLen = cd.getUint16(p + 32, true);
    let localHeaderOffset = cd.getUint32(p + 42, true);
    const name = decoder.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen));

    // ZIP64 extended info (extra field 0x0001) holds the real 64-bit values.
    let e = p + 46 + nameLen;
    const extraEnd = e + extraLen;
    while (e + 4 <= extraEnd) {
      const id = cd.getUint16(e, true);
      const len = cd.getUint16(e + 2, true);
      if (id === 0x0001) {
        let q = e + 4;
        if (size === MAX_U32) {
          size = u64(cd, q);
          q += 8;
        }
        if (compressedSize === MAX_U32) {
          compressedSize = u64(cd, q);
          q += 8;
        }
        if (localHeaderOffset === MAX_U32) localHeaderOffset = u64(cd, q);
      }
      e += 4 + len;
    }

    entries.push({ name, method, compressedSize, size, localHeaderOffset, encrypted: (flags & 1) === 1 });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

export async function readZipEntryText(blob: Blob, entry: ZipEntry): Promise<string> {
  if (entry.encrypted) throw new Error(`${entry.name} is encrypted.`);
  const header = await view(blob, entry.localHeaderOffset, entry.localHeaderOffset + 30);
  if (header.getUint32(0, true) !== SIG_LOCAL) throw new Error(`Corrupt zip entry: ${entry.name}`);
  const dataStart = entry.localHeaderOffset + 30 + header.getUint16(26, true) + header.getUint16(28, true);
  const data = blob.slice(dataStart, dataStart + entry.compressedSize);

  if (entry.method === 0) return data.text();
  if (entry.method === 8) {
    const stream = data.stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Response(stream).text();
  }
  throw new Error(`Unsupported compression in ${entry.name}.`);
}
