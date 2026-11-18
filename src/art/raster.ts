import type { Art } from '../game/types';

/**
 * Pictures are described as layered vector shapes in a 100×100 box and then
 * rasterised to whatever grid size a level asks for, so the same picture works
 * as a 12-cell warm-up and as a 32-cell late level.
 */
export interface Shape {
  /** Colour key into BASE, or '.' to punch a hole through the layers below. */
  c: string;
  hit: (x: number, y: number) => boolean;
  box: readonly [number, number, number, number];
}

const BASE: Record<string, string> = {
  r: '#f4505e',
  R: '#c93248',
  o: '#ff9a3d',
  O: '#ee7526',
  y: '#ffd23f',
  Y: '#f5a81c',
  l: '#b9e45c',
  g: '#62c84a',
  G: '#2f9a55',
  a: '#7fe0c3',
  c: '#72d2f6',
  b: '#3f8ff0',
  B: '#2f52b0',
  d: '#414c72',
  v: '#9d74f2',
  V: '#6f48c9',
  p: '#ff9cc2',
  P: '#f2578f',
  n: '#b06c3c',
  N: '#74442a',
  T: '#ebb66a',
  t: '#f7d9ab',
  m: '#ffecd2',
  w: '#ffffff',
  s: '#cfd6e8',
  S: '#8f9ab8',
  k: '#3a3350',
};

const deg = (a: number): number => (a * Math.PI) / 180;

export function E(c: string, cx: number, cy: number, rx: number, ry = rx, rot = 0): Shape {
  const cos = Math.cos(deg(rot));
  const sin = Math.sin(deg(rot));
  const bx = Math.hypot(rx * cos, ry * sin);
  const by = Math.hypot(rx * sin, ry * cos);
  return {
    c,
    box: [cx - bx, cy - by, cx + bx, cy + by],
    hit: (x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      const u = (dx * cos + dy * sin) / rx;
      const v = (-dx * sin + dy * cos) / ry;
      return u * u + v * v <= 1;
    },
  };
}

export function R(c: string, x: number, y: number, w: number, h: number, r = 0): Shape {
  const radius = Math.min(r, w / 2, h / 2);
  const cx = x + w / 2;
  const cy = y + h / 2;
  return {
    c,
    box: [x, y, x + w, y + h],
    hit: (px, py) => {
      const qx = Math.abs(px - cx) - (w / 2 - radius);
      const qy = Math.abs(py - cy) - (h / 2 - radius);
      if (qx <= 0 && qy <= 0) return true;
      if (qx > radius || qy > radius) return false;
      if (qx <= 0 || qy <= 0) return true;
      return qx * qx + qy * qy <= radius * radius;
    },
  };
}

export function P(c: string, ...pts: number[]): Shape {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    x0 = Math.min(x0, pts[i]);
    x1 = Math.max(x1, pts[i]);
    y0 = Math.min(y0, pts[i + 1]);
    y1 = Math.max(y1, pts[i + 1]);
  }
  const n = pts.length / 2;
  return {
    c,
    box: [x0, y0, x1, y1],
    hit: (x, y) => {
      let inside = false;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = pts[i * 2];
        const yi = pts[i * 2 + 1];
        const xj = pts[j * 2];
        const yj = pts[j * 2 + 1];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    },
  };
}

/** Thick polyline with round caps and joins. */
export function L(c: string, width: number, ...pts: number[]): Shape {
  const half = width / 2;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    x0 = Math.min(x0, pts[i]);
    x1 = Math.max(x1, pts[i]);
    y0 = Math.min(y0, pts[i + 1]);
    y1 = Math.max(y1, pts[i + 1]);
  }
  return {
    c,
    box: [x0 - half, y0 - half, x1 + half, y1 + half],
    hit: (x, y) => {
      for (let i = 0; i + 3 < pts.length; i += 2) {
        const ax = pts[i];
        const ay = pts[i + 1];
        const bx = pts[i + 2];
        const by = pts[i + 3];
        const vx = bx - ax;
        const vy = by - ay;
        const len = vx * vx + vy * vy;
        const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / len));
        const dx = x - (ax + vx * t);
        const dy = y - (ay + vy * t);
        if (dx * dx + dy * dy <= half * half) return true;
      }
      return false;
    },
  };
}

/** Regular star / burst polygon. */
export function star(
  c: string,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  points = 5,
  rot = -90,
): Shape {
  const pts: number[] = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = deg(rot) + (i * Math.PI) / points;
    const r = i % 2 === 0 ? outer : inner;
    pts.push(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
  }
  return P(c, ...pts);
}

/** Keeps only the part of a shape inside the given rectangle. */
export function clip(s: Shape, x0: number, y0: number, x1: number, y1: number): Shape {
  return {
    c: s.c,
    box: [
      Math.max(s.box[0], x0),
      Math.max(s.box[1], y0),
      Math.min(s.box[2], x1),
      Math.min(s.box[3], y1),
    ],
    hit: (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1 && s.hit(x, y),
  };
}

/** The shape plus its mirror image across the vertical centre line. */
export function pair(s: Shape): Shape[] {
  return [
    s,
    {
      c: s.c,
      box: [100 - s.box[2], s.box[1], 100 - s.box[0], s.box[3]],
      hit: (x, y) => s.hit(100 - x, y),
    },
  ];
}

export interface KeyGrid {
  w: number;
  h: number;
  /** One colour key per cell, '' where the cell is empty. */
  keys: string[];
}

const SUB = 4;
const COVERAGE = 0.42;

export function rasterize(shapes: readonly Shape[], size: number): KeyGrid {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of shapes) {
    if (s.c === '.') continue;
    x0 = Math.min(x0, s.box[0]);
    y0 = Math.min(y0, s.box[1]);
    x1 = Math.max(x1, s.box[2]);
    y1 = Math.max(y1, s.box[3]);
  }
  if (!(x1 > x0) || !(y1 > y0)) return { w: 0, h: 0, keys: [] };

  const cell = Math.max(x1 - x0, y1 - y0) / size;
  const w = Math.max(1, Math.ceil((x1 - x0) / cell - 1e-6));
  const h = Math.max(1, Math.ceil((y1 - y0) / cell - 1e-6));
  const ox = (x0 + x1) / 2 - (w * cell) / 2;
  const oy = (y0 + y1) / 2 - (h * cell) / 2;

  const keys: string[] = new Array(w * h).fill('');
  const tally = new Map<string, number>();
  const rank = new Map<string, number>();

  for (let gy = 0; gy < h; gy++) {
    for (let gx = 0; gx < w; gx++) {
      tally.clear();
      rank.clear();
      let filled = 0;
      for (let sy = 0; sy < SUB; sy++) {
        for (let sx = 0; sx < SUB; sx++) {
          const px = ox + (gx + (sx + 0.5) / SUB) * cell;
          const py = oy + (gy + (sy + 0.5) / SUB) * cell;
          for (let i = shapes.length - 1; i >= 0; i--) {
            const s = shapes[i];
            if (px < s.box[0] || px > s.box[2] || py < s.box[1] || py > s.box[3]) continue;
            if (!s.hit(px, py)) continue;
            if (s.c !== '.') {
              filled++;
              tally.set(s.c, (tally.get(s.c) ?? 0) + 1);
              if ((rank.get(s.c) ?? -1) < i) rank.set(s.c, i);
            }
            break;
          }
        }
      }
      if (filled < SUB * SUB * COVERAGE) continue;
      let best = '';
      let bestCount = 0;
      let bestRank = -1;
      for (const [key, count] of tally) {
        const r = rank.get(key) ?? -1;
        if (count > bestCount || (count === bestCount && r > bestRank)) {
          best = key;
          bestCount = count;
          bestRank = r;
        }
      }
      keys[gy * w + gx] = best;
    }
  }

  return cropGrid({ w, h, keys });
}

function cropGrid(grid: KeyGrid): KeyGrid {
  const { w, h, keys } = grid;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (keys[y * w + x] === '') continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < x0) return { w: 0, h: 0, keys: [] };
  if (x0 === 0 && y0 === 0 && x1 === w - 1 && y1 === h - 1) return grid;
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const out: string[] = new Array(cw * ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) out[y * cw + x] = keys[(y + y0) * w + (x + x0)];
  }
  return { w: cw, h: ch, keys: out };
}

function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue: number;
  if (max === r) hue = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  return [hue * 60, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const k = (n: number): number => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): number => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  const to = (v: number): string =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

type Tone = 'base' | 'edge' | 'hi' | 'lo';

/** Shadows drift towards violet, the way hand-made pixel art shades. */
function toneColor(key: string, tone: Tone, soft: boolean): string {
  const base = BASE[key] ?? '#9a92bd';
  if (tone === 'base') return base;
  if (key === 'w') {
    return tone === 'edge' ? (soft ? '#cdd5ea' : '#bcc5e0') : tone === 'lo' ? '#e6eaf6' : '#ffffff';
  }
  if (key === 'k') return tone === 'hi' ? '#544b70' : base;
  const [h, s, l] = hexToHsl(base);
  const towards = (from: number, to: number, amount: number): number => {
    const delta = ((to - from + 540) % 360) - 180;
    return (from + delta * amount + 360) % 360;
  };
  if (tone === 'edge') {
    return hslToHex(towards(h, 265, soft ? 0.06 : 0.1), s * 0.94, l * (soft ? 0.82 : 0.72));
  }
  if (tone === 'lo') return hslToHex(towards(h, 265, 0.05), s, l * 0.88);
  return hslToHex(h, s, l + (1 - l) * 0.3);
}

/**
 * Turns a key grid into paletted art: silhouette cells get a darker rim so the
 * picture reads against a pale board, and bigger grids get a one-cell bevel.
 */
export function toneGrid(grid: KeyGrid): Art {
  const { w, h, keys } = grid;
  const filled = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < w && y < h && keys[y * w + x] !== '';
  const edge = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!filled(x, y)) continue;
      if (!filled(x - 1, y) || !filled(x + 1, y) || !filled(x, y - 1) || !filled(x, y + 1)) {
        edge[y * w + x] = 1;
      }
    }
  }

  const bevel = Math.max(w, h) >= 20;
  const palette: string[] = [];
  const index = new Map<string, number>();
  const color = new Int16Array(w * h).fill(-1);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const at = y * w + x;
      const key = keys[at];
      if (key === '') continue;
      let tone: Tone = 'base';
      if (edge[at]) {
        tone = 'edge';
      } else if (bevel) {
        const lit = edge[at - 1] === 1 || edge[at - w] === 1;
        const shaded = edge[at + 1] === 1 || edge[at + w] === 1;
        if (lit && !shaded) tone = 'hi';
        else if (shaded && !lit) tone = 'lo';
      }
      const id = `${key}/${tone}`;
      let slot = index.get(id);
      if (slot === undefined) {
        slot = palette.length;
        palette.push(toneColor(key, tone, !bevel));
        index.set(id, slot);
      }
      color[at] = slot;
    }
  }

  return { w, h, palette, color };
}
