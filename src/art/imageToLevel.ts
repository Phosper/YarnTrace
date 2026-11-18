import type { Art } from '../game/types';

const MAX_COLORS = 12;
const ALPHA_MIN = 40;

export interface RawImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

function toHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

interface Bucket {
  r: number;
  g: number;
  b: number;
  n: number;
}

function quantize(raw: RawImage, maxColors: number): { palette: string[]; index: Int16Array } {
  const buckets = new Map<number, Bucket>();
  const pixelCount = raw.width * raw.height;
  let opaque = 0;

  for (let i = 0; i < pixelCount; i++) {
    if (raw.data[i * 4 + 3] < ALPHA_MIN) continue;
    opaque++;
    const r = raw.data[i * 4];
    const g = raw.data[i * 4 + 1];
    const b = raw.data[i * 4 + 2];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.n++;
    } else {
      buckets.set(key, { r, g, b, n: 1 });
    }
  }

  const ranked = [...buckets.values()].sort((a, b) => b.n - a.n).slice(0, maxColors);
  const palette: string[] = [];
  const centers: Array<[number, number, number]> = [];

  for (const bucket of ranked) {
    const r = Math.round(bucket.r / bucket.n);
    const g = Math.round(bucket.g / bucket.n);
    const b = Math.round(bucket.b / bucket.n);
    palette.push(toHex(r, g, b));
    centers.push([r, g, b]);
  }

  if (centers.length === 0) {
    palette.push('#8a6cf0');
    centers.push([138, 108, 240]);
  }

  const index = new Int16Array(pixelCount).fill(-1);
  for (let i = 0; i < pixelCount; i++) {
    if (raw.data[i * 4 + 3] < ALPHA_MIN) continue;
    const r = raw.data[i * 4];
    const g = raw.data[i * 4 + 1];
    const b = raw.data[i * 4 + 2];
    let best = 0;
    let bestDist = Infinity;
    for (let c = 0; c < centers.length; c++) {
      const [cr, cg, cb] = centers[c];
      const dist = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        best = c;
      }
    }
    index[i] = best;
  }

  return { palette, index };
}

function dropBackground(raw: RawImage, index: Int16Array): void {
  const { width, height } = raw;
  const corners = [0, width - 1, (height - 1) * width, height * width - 1];
  let bg = -1;
  let bgVotes = 0;
  const tally = new Map<number, number>();
  for (const c of corners) {
    const v = index[c];
    if (v < 0) continue;
    const n = (tally.get(v) ?? 0) + 1;
    tally.set(v, n);
    if (n > bgVotes) {
      bgVotes = n;
      bg = v;
    }
  }
  if (bg < 0 || bgVotes < 3) return;

  let hits = 0;
  for (let i = 0; i < index.length; i++) if (index[i] === bg) hits++;
  if (hits / index.length < 0.22) return;

  for (let i = 0; i < index.length; i++) if (index[i] === bg) index[i] = -1;
}

function keepBigComponents(index: Int16Array, w: number, h: number, minSize: number): void {
  const seen = new Uint8Array(w * h);
  for (let start = 0; start < index.length; start++) {
    if (index[start] < 0 || seen[start]) continue;
    const component: number[] = [];
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const cur = stack.pop() as number;
      component.push(cur);
      const x = cur % w;
      const y = Math.floor(cur / w);
      const neighbours = [
        x > 0 ? cur - 1 : -1,
        x < w - 1 ? cur + 1 : -1,
        y > 0 ? cur - w : -1,
        y < h - 1 ? cur + w : -1,
      ];
      for (const n of neighbours) {
        if (n < 0 || seen[n] || index[n] < 0) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    if (component.length < minSize) {
      for (const i of component) index[i] = -1;
    }
  }
}

function fillSingleHoles(index: Int16Array, w: number, h: number): void {
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (index[i] >= 0) continue;
      const around = [index[i - 1], index[i + 1], index[i - w], index[i + w]];
      if (around.every((v) => v >= 0)) index[i] = around[0];
    }
  }
}

export function artFromRawImage(raw: RawImage, maxGrid = 40): Art {
  const { palette, index } = quantize(raw, MAX_COLORS);
  dropBackground(raw, index);
  keepBigComponents(index, raw.width, raw.height, 8);
  fillSingleHoles(index, raw.width, raw.height);

  let minX = raw.width;
  let minY = raw.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < raw.height; y++) {
    for (let x = 0; x < raw.width; x++) {
      if (index[y * raw.width + x] < 0) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) {
    return { w: Math.min(12, maxGrid), h: Math.min(12, maxGrid), palette: ['#8a6cf0', '#5a3cbf', '#241247'], color: new Int16Array(Math.min(12, maxGrid) ** 2).fill(-1) };
  }

  const nw = Math.min(maxGrid, maxX - minX + 1);
  const nh = Math.min(maxGrid, maxY - minY + 1);
  const color = new Int16Array(nw * nh).fill(-1);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      color[y * nw + x] = index[(y + minY) * raw.width + (x + minX)];
    }
  }

  return { w: nw, h: nh, palette, color };
}

export async function artFromFile(file: File, maxGrid = 40): Promise<Art> {
  const bitmap = await createImageBitmap(file);
  const scale = maxGrid / Math.max(bitmap.width, bitmap.height);
  const gw = Math.max(8, Math.round(bitmap.width * scale));
  const gh = Math.max(8, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = gw;
  canvas.height = gh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, gw, gh);
  bitmap.close();
  const data = ctx.getImageData(0, 0, gw, gh).data;
  return artFromRawImage({ width: gw, height: gh, data }, maxGrid);
}
