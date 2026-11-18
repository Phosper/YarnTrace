import { artFromMask } from './procedural';
import { themeById } from './palette';
import type { Art } from '../game/types';

export interface TemplateDef {
  id: string;
  name: string;
  theme: string;
  size: number;
  hit: (u: number, v: number) => boolean;
}

function inCircle(u: number, v: number, cx: number, cy: number, r: number): boolean {
  return (u - cx) ** 2 + (v - cy) ** 2 <= r * r;
}

function inEllipse(u: number, v: number, cx: number, cy: number, rx: number, ry: number): boolean {
  return ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 <= 1;
}

function inRect(u: number, v: number, x0: number, y0: number, x1: number, y1: number): boolean {
  return u >= x0 && u <= x1 && v >= y0 && v <= y1;
}

function inPoly(u: number, v: number, pts: ReadonlyArray<readonly [number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const STAR: ReadonlyArray<readonly [number, number]> = Array.from({ length: 10 }, (_, i) => {
  const angle = -Math.PI / 2 + (i * Math.PI) / 5;
  const r = i % 2 === 0 ? 0.46 : 0.2;
  return [0.5 + Math.cos(angle) * r, 0.52 + Math.sin(angle) * r] as const;
});

const FLOWER_PETALS: ReadonlyArray<readonly [number, number]> = Array.from({ length: 5 }, (_, i) => {
  const angle = -Math.PI / 2 + (i * Math.PI * 2) / 5;
  return [0.5 + Math.cos(angle) * 0.26, 0.5 + Math.sin(angle) * 0.26] as const;
});

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'heart',
    name: '爱心',
    theme: 'berry',
    size: 16,
    hit: (u, v) => inCircle(u, v, 0.32, 0.38, 0.23) || inCircle(u, v, 0.68, 0.38, 0.23) || inPoly(u, v, [
      [0.09, 0.41],
      [0.91, 0.41],
      [0.5, 0.94],
    ]),
  },
  {
    id: 'star',
    name: '星星',
    theme: 'ember',
    size: 16,
    hit: (u, v) => inPoly(u, v, STAR),
  },
  {
    id: 'apple',
    name: '苹果',
    theme: 'berry',
    size: 16,
    hit: (u, v) =>
      inCircle(u, v, 0.5, 0.64, 0.33) ||
      inRect(u, v, 0.465, 0.14, 0.535, 0.34) ||
      inEllipse(u, v, 0.63, 0.2, 0.12, 0.06),
  },
  {
    id: 'mushroom',
    name: '蘑菇',
    theme: 'rose',
    size: 16,
    hit: (u, v) =>
      (v <= 0.47 && inEllipse(u, v, 0.5, 0.44, 0.46, 0.36)) ||
      (v > 0.4 && v <= 0.88 && Math.abs(u - 0.5) <= 0.17) ||
      inEllipse(u, v, 0.5, 0.87, 0.19, 0.07),
  },
  {
    id: 'fish',
    name: '小鱼',
    theme: 'ocean',
    size: 16,
    hit: (u, v) =>
      inEllipse(u, v, 0.42, 0.5, 0.32, 0.24) ||
      inPoly(u, v, [
        [0.68, 0.5],
        [0.99, 0.26],
        [0.99, 0.74],
      ]),
  },
  {
    id: 'cat',
    name: '猫头',
    theme: 'slate',
    size: 16,
    hit: (u, v) =>
      inCircle(u, v, 0.5, 0.6, 0.3) ||
      inPoly(u, v, [
        [0.26, 0.44],
        [0.3, 0.08],
        [0.54, 0.36],
      ]) ||
      inPoly(u, v, [
        [0.74, 0.44],
        [0.7, 0.08],
        [0.46, 0.36],
      ]),
  },
  {
    id: 'cloud',
    name: '云朵',
    theme: 'ocean',
    size: 16,
    hit: (u, v) =>
      inCircle(u, v, 0.32, 0.56, 0.18) ||
      inCircle(u, v, 0.5, 0.45, 0.22) ||
      inCircle(u, v, 0.68, 0.56, 0.18) ||
      inEllipse(u, v, 0.5, 0.66, 0.28, 0.1),
  },
  {
    id: 'flower',
    name: '小花',
    theme: 'mint',
    size: 16,
    hit: (u, v) =>
      inCircle(u, v, 0.5, 0.5, 0.14) ||
      FLOWER_PETALS.some(([px, py]) => inCircle(u, v, px, py, 0.16)),
  },
];

export function templateArt(id: string, size?: number): Art | null {
  const def = TEMPLATES.find((t) => t.id === id);
  if (!def) return null;
  const n = Math.max(10, Math.min(44, size ?? def.size));
  const grid = new Uint8Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (def.hit((x + 0.5) / n, (y + 0.5) / n)) grid[y * n + x] = 1;
    }
  }
  return artFromMask(grid, n, n, themeById(def.theme), 7);
}
