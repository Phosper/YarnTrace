// Draws the app icon (a pixel heart of yarn tiles on a soft gradient) and
// writes it as PNG with nothing but Node built-ins: `npm run icons`.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const HEART = [
  '.XX...XX.',
  'XXXX.XXXX',
  'XXXXXXXXX',
  'XXXXXXXXX',
  '.XXXXXXX.',
  '..XXXXX..',
  '...XXX...',
  '....X....',
];

const SS = 3;

const lerp = (a, b, t) => a + (b - a) * t;

/** Signed distance to a rounded square centred on (cx, cy). */
function roundBox(x, y, cx, cy, half, radius) {
  const qx = Math.abs(x - cx) - (half - radius);
  const qy = Math.abs(y - cy) - (half - radius);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

function render(size) {
  const n = size * SS;
  const px = new Float32Array(n * n * 3);
  const cols = HEART[0].length;
  const rows = HEART.length;
  // Everything sits inside the central 62% so maskable crops never cut the heart.
  const cell = (n * 0.62) / cols;
  const ox = (n - cols * cell) / 2;
  const oy = (n - rows * cell) / 2 + cell * 0.25;

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const t = (x + y) / (2 * n);
      let r = lerp(250, 222, t);
      let g = lerp(240, 228, t);
      let b = lerp(255, 253, t);

      const gx = Math.floor((x - ox) / cell);
      const gy = Math.floor((y - oy) / cell);
      for (let cy = gy - 1; cy <= gy + 1; cy++) {
        for (let cx = gx - 1; cx <= gx + 1; cx++) {
          if (HEART[cy]?.[cx] !== 'X') continue;
          const mx = ox + (cx + 0.5) * cell;
          const my = oy + (cy + 0.5) * cell;
          // Soft shadow below, darker rim, then the bright face with a sheen.
          if (roundBox(x, y, mx, my + cell * 0.1, cell * 0.47, cell * 0.2) < 0) {
            r = lerp(r, 120, 0.2);
            g = lerp(g, 96, 0.2);
            b = lerp(b, 190, 0.2);
          }
          if (roundBox(x, y, mx, my, cell * 0.46, cell * 0.2) < 0) {
            r = 201;
            g = 44;
            b = 78;
          }
          if (roundBox(x, y, mx, my, cell * 0.4, cell * 0.16) < 0) {
            const shade = (y - (my - cell * 0.4)) / (cell * 0.8);
            r = lerp(255, 240, shade);
            g = lerp(112, 72, shade);
            b = lerp(132, 98, shade);
          }
          if (roundBox(x, y, mx - cell * 0.1, my - cell * 0.17, cell * 0.2, cell * 0.08) < -cell * 0.1) {
            r = lerp(r, 255, 0.45);
            g = lerp(g, 255, 0.45);
            b = lerp(b, 255, 0.45);
          }
        }
      }

      const at = (y * n + x) * 3;
      px[at] = r;
      px[at + 1] = g;
      px[at + 2] = b;
    }
  }

  const out = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    out[row] = 0;
    for (let x = 0; x < size; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let sy = 0; sy < SS; sy++) {
          for (let sx = 0; sx < SS; sx++) sum += px[((y * SS + sy) * n + x * SS + sx) * 3 + c];
        }
        out[row + 1 + x * 3 + c] = Math.round(sum / (SS * SS));
      }
    }
  }
  return out;
}

const CRC = new Uint32Array(256).map((_, i) => {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  let crc = 0xffffffff;
  for (const byte of body) crc = CRC[(crc ^ byte) & 255] ^ (crc >>> 8);
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([head, body, tail]);
}

function png(size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(render(size), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  const file = new URL(`../public/icon-${size}.png`, import.meta.url);
  writeFileSync(file, png(size));
  console.log(`wrote public/icon-${size}.png`);
}
