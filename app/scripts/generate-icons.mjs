// Generates the app icon set: a comic-yellow square with a red "TA" monogram.
// Only Node built-ins. Usage: node scripts/generate-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const BLUE = [255, 212, 0]; // #FFD400 comic yellow (background)
const WHITE = [228, 0, 43]; // #E4002B comic red (monogram)

// ---------- PNG encoding ----------
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- "TA" monogram (font units: cap height 100) ----------
function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inRect = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

const A_X = 78; // T is 0..70, gap 8, A is 78..162
const A_OUTER = [
  [31, 0], [53, 0], [84, 100], [63, 100], [56.2, 78], [27.8, 78], [21, 100], [0, 100],
].map(([x, y]) => [x + A_X, y]);
const A_COUNTER = [[42, 32.3], [34, 58], [50, 58]].map(([x, y]) => [x + A_X, y]);
const GLYPH_W = 162;

function glyph(fx, fy) {
  if (inRect(fx, fy, 0, 0, 70, 22) || inRect(fx, fy, 24, 0, 46, 100)) return true;
  return inPoly(fx, fy, A_OUTER) && !inPoly(fx, fy, A_COUNTER);
}

function roundRect(x, y, r) {
  // unit square with corner radius r
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/**
 * background: 'full' (edge-to-edge blue), 'rounded' (blue rounded square, transparent corners) or null.
 * cap: monogram cap height as a fraction of the image.
 */
function render(size, { background = 'full', cap = 0.3, glyphColor = WHITE }) {
  const buf = Buffer.alloc(size * size * 4);
  const SS = 4;
  const unit = cap / 100;
  const x0 = 0.5 - (GLYPH_W * unit) / 2;
  const y0 = 0.5 - (100 * unit) / 2;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const ux = (px + (sx + 0.5) / SS) / size;
          const uy = (py + (sy + 0.5) / SS) / size;
          let c = null;
          if (glyph((ux - x0) / unit, (uy - y0) / unit)) c = glyphColor;
          else if (background === 'full' || (background === 'rounded' && roundRect(ux, uy, 0.225))) c = BLUE;
          if (c) {
            r += c[0];
            g += c[1];
            b += c[2];
            a += 1;
          }
        }
      }
      const o = (py * size + px) * 4;
      if (a) {
        buf[o] = Math.round(r / a);
        buf[o + 1] = Math.round(g / a);
        buf[o + 2] = Math.round(b / a);
      }
      buf[o + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  return encodePng(size, size, buf);
}

function solid(size, rgb) {
  const buf = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) buf.set([...rgb, 255], i * 4);
  return encodePng(size, size, buf);
}

const outputs = [
  ['assets/icon.png', () => render(1024, { background: 'full' })],
  ['assets/adaptive-icon.png', () => render(1024, { background: null, cap: 0.2 })],
  ['assets/adaptive-icon-background.png', () => solid(1024, BLUE)],
  ['assets/adaptive-icon-monochrome.png', () => render(1024, { background: null, cap: 0.2 })],
  ['assets/splash-icon.png', () => render(1024, { background: 'rounded' })],
  ['assets/favicon.png', () => render(48, { background: 'rounded', cap: 0.36 })],
  ['assets/pwa/apple-touch-icon.png', () => render(180, { background: 'full' })],
  ['assets/pwa/icon-192.png', () => render(192, { background: 'rounded' })],
  ['assets/pwa/icon-512.png', () => render(512, { background: 'rounded' })],
  ['assets/pwa/icon-maskable-512.png', () => render(512, { background: 'full', cap: 0.24 })],
];

for (const [rel, make] of outputs) {
  const file = join(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, make());
  console.log('wrote', rel);
}
