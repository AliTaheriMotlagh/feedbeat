// Renders the Feedbeat logo (public/logo.svg) to the PNG sizes Chrome wants.
// Dependency-free: the logo is a gradient tile with three bars, drawn here directly.
// Usage: node scripts/extension-icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const OUT = new URL("../extension/icons/", import.meta.url);
const SIZES = [16, 32, 48, 128];
const STOPS = [
  [0, [0xd9, 0x46, 0xef]],
  [0.5, [0x8b, 0x5c, 0xf6]],
  [1, [0x22, 0xd3, 0xee]],
];
// In the logo's 64×64 space: [x, y, width, height, radius].
const TILE = [0, 0, 64, 64, 16];
const BARS = [
  [17, 26, 8, 24, 4],
  [28, 14, 8, 36, 4],
  [39, 22, 8, 28, 4],
];
const SAMPLES = 4; // per axis, for anti-aliasing

function inRoundRect(x, y, [rx, ry, w, h, r]) {
  if (x < rx || y < ry || x > rx + w || y > ry + h) return false;
  const cx = Math.min(Math.max(x, rx + r), rx + w - r);
  const cy = Math.min(Math.max(y, ry + r), ry + h - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function gradient(t) {
  const i = t <= 0.5 ? 0 : 1;
  const [t0, c0] = STOPS[i];
  const [t1, c1] = STOPS[i + 1];
  const k = (t - t0) / (t1 - t0);
  return c0.map((v, j) => v + (c1[j] - v) * k);
}

function render(size) {
  const px = Buffer.alloc(size * size * 4);
  const scale = 64 / size;
  for (let py = 0; py < size; py++) {
    for (let pxl = 0; pxl < size; pxl++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = (pxl + (sx + 0.5) / SAMPLES) * scale;
          const y = (py + (sy + 0.5) / SAMPLES) * scale;
          if (!inRoundRect(x, y, TILE)) continue;
          const c = BARS.some((bar) => inRoundRect(x, y, bar)) ? [255, 255, 255] : gradient((x + y) / 128);
          r += c[0];
          g += c[1];
          b += c[2];
          a++;
        }
      }
      const o = (py * size + pxl) * 4;
      const n = SAMPLES * SAMPLES;
      // Straight (non-premultiplied) alpha: average color over covered samples.
      px[o] = a ? Math.round(r / a) : 0;
      px[o + 1] = a ? Math.round(g / a) : 0;
      px[o + 2] = a ? Math.round(b / a) : 0;
      px[o + 3] = Math.round((a / n) * 255);
    }
  }
  return px;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
for (const size of SIZES) {
  writeFileSync(new URL(`icon${size}.png`, OUT), png(size, render(size)));
  console.log(`extension/icons/icon${size}.png`);
}
