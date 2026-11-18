import { clamp, mulberry32, randInt, type Rng } from '../game/rng';
import { DIRS, type Art } from '../game/types';
import { THEMES, type Theme } from './palette';

export interface ArtOptions {
  size?: number;
  theme?: string;
}

function growShape(rng: Rng, w: number, h: number): Uint8Array {
  const half = Math.ceil(w / 2);
  const grid = new Uint8Array(w * h);
  const inFrontier = new Uint8Array(w * h);
  const frontier: number[] = [];
  let filled = 0;
  let minX = half - 1;
  let maxX = half - 1;
  let minY = Math.floor(h / 2);
  let maxY = Math.floor(h / 2);

  const push = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= half || y >= h) return;
    const i = y * w + x;
    if (grid[i] || inFrontier[i]) return;
    inFrontier[i] = 1;
    frontier.push(i);
  };

  const add = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= half || y >= h) return;
    const i = y * w + x;
    if (grid[i]) return;
    grid[i] = 1;
    inFrontier[i] = 0;
    filled++;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    for (let d = 0; d < 4; d++) push(x + DIRS[d][0], y + DIRS[d][1]);
  };

  const cy = Math.floor(h / 2);
  add(half - 1, cy);
  add(half - 1, cy - 1);
  add(half - 2, cy);
  add(half - 3, cy + 1);

  const wantW = Math.max(5, half - 1 - randInt(rng, 2));
  const wantH = Math.max(6, h - 1 - randInt(rng, 3));
  const cap = Math.round(half * h * 0.92);
  let guard = 0;
  let stale = 0;

  while (frontier.length > 0 && filled < cap && guard++ < 20000) {
    if (maxX - minX + 1 >= wantW && maxY - minY + 1 >= wantH) break;

    let bestIndex = -1;
    let bestScore = -1;
    for (let t = 0; t < 6; t++) {
      const candidate = frontier[randInt(rng, frontier.length)];
      if (grid[candidate]) continue;
      const x = candidate % w;
      const y = Math.floor(candidate / w);
      let score = rng() * 1.4;
      for (let d = 0; d < 4; d++) {
        const nx = x + DIRS[d][0];
        const ny = y + DIRS[d][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (grid[ny * w + nx]) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestIndex = candidate;
      }
    }

    if (bestIndex < 0) {
      for (let i = frontier.length - 1; i >= 0; i--) {
        if (grid[frontier[i]]) frontier.splice(i, 1);
      }
      if (++stale > 40) break;
      continue;
    }

    stale = 0;
    add(bestIndex % w, Math.floor(bestIndex / w));
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < half; x++) {
      if (grid[y * w + x]) grid[y * w + (w - 1 - x)] = 1;
    }
  }

  return grid;
}

function keepLargestComponent(grid: Uint8Array, w: number, h: number): Uint8Array {
  const seen = new Uint8Array(w * h);
  let best: number[] = [];

  for (let start = 0; start < grid.length; start++) {
    if (!grid[start] || seen[start]) continue;
    const component: number[] = [];
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const cur = stack.pop() as number;
      component.push(cur);
      const x = cur % w;
      const y = Math.floor(cur / w);
      for (let d = 0; d < 4; d++) {
        const nx = x + DIRS[d][0];
        const ny = y + DIRS[d][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (grid[ni] && !seen[ni]) {
          seen[ni] = 1;
          stack.push(ni);
        }
      }
    }
    if (component.length > best.length) best = component;
  }

  const out = new Uint8Array(w * h);
  for (const i of best) out[i] = 1;
  return out;
}

function dropIsolated(grid: Uint8Array, w: number, h: number): void {
  const copy = grid.slice();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!grid[y * w + x]) continue;
      let neighbours = 0;
      for (let d = 0; d < 4; d++) {
        const nx = x + DIRS[d][0];
        const ny = y + DIRS[d][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (grid[ny * w + nx]) neighbours++;
      }
      if (neighbours === 0) copy[y * w + x] = 0;
    }
  }
  grid.set(copy);
}

function fillHoles(grid: Uint8Array, w: number, h: number): void {
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (grid[i]) continue;
      if (grid[i - 1] && grid[i + 1] && grid[i - w] && grid[i + w]) grid[i] = 1;
    }
  }
}

function crop(grid: Uint8Array, w: number, h: number): { grid: Uint8Array; w: number; h: number } {
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!grid[y * w + x]) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return { grid, w, h };
  const nw = maxX - minX + 1;
  const nh = maxY - minY + 1;
  const out = new Uint8Array(nw * nh);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      out[y * nw + x] = grid[(y + minY) * w + (x + minX)];
    }
  }
  return { grid: out, w: nw, h: nh };
}

export function colorize(grid: Uint8Array, w: number, h: number, theme: Theme, rng: Rng): Art {
  const color = new Int16Array(w * h).fill(-1);
  let minY = h;
  let maxY = -1;
  let count = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!grid[y * w + x]) continue;
      count++;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const span = Math.max(1, maxY - minY);
  const emptyNeighbours = (x: number, y: number): number => {
    let empty = 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + DIRS[d][0];
      const ny = y + DIRS[d][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || !grid[ny * w + nx]) empty++;
    }
    return empty;
  };

  const interior: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!grid[y * w + x]) continue;
      const empty = emptyNeighbours(x, y);
      if (empty >= 2) {
        color[y * w + x] = 3;
        continue;
      }
      if (empty === 1) {
        color[y * w + x] = 2;
        continue;
      }
      const t = (y - minY) / span;
      color[y * w + x] = t < 0.34 ? 0 : t < 0.74 ? 1 : 2;
      interior.push(y * w + x);
    }
  }

  const budget = Math.max(4, Math.round(count * 0.06));
  const blobs = 1 + randInt(rng, 2);
  for (let b = 0; b < blobs && interior.length > 0; b++) {
    const start = interior[randInt(rng, interior.length)];
    const stack = [start];
    const limit = Math.max(3, Math.round(budget * (0.5 + rng())));
    let added = 0;
    while (stack.length > 0 && added < limit) {
      const cur = stack.pop() as number;
      if (color[cur] === 4 || color[cur] === 3) continue;
      color[cur] = 4;
      added++;
      const x = cur % w;
      const y = Math.floor(cur / w);
      for (let d = 0; d < 4; d++) {
        const nx = x + DIRS[d][0];
        const ny = y + DIRS[d][1];
        if (nx <= 0 || ny <= 0 || nx >= w - 1 || ny >= h - 1) continue;
        const ni = ny * w + nx;
        if (grid[ni]) stack.push(ni);
      }
    }
  }

  return { w, h, palette: theme.colors.slice(), color };
}

export function generateArt(seed: number, opts: ArtOptions = {}): Art {
  const base = opts.size ?? 20;
  let fallback: Art | null = null;
  let fallbackCells = -1;

  for (let attempt = 0; attempt < 10; attempt++) {
    const rng = mulberry32((seed + attempt * 0x9e3779b1) >>> 0);
    const theme = opts.theme
      ? THEMES.find((t) => t.id === opts.theme) ?? THEMES[0]
      : THEMES[randInt(rng, THEMES.length)];

    const w = clamp(base + Math.round((rng() - 0.5) * 3), 12, 44);
    const h = clamp(base + Math.round((rng() - 0.5) * 3), 12, 44);

    let grid = growShape(rng, w, h);
    dropIsolated(grid, w, h);
    grid = keepLargestComponent(grid, w, h);
    fillHoles(grid, w, h);
    const cropped = crop(grid, w, h);

    let cells = 0;
    for (let i = 0; i < cropped.grid.length; i++) cells += cropped.grid[i];
    const art = colorize(cropped.grid, cropped.w, cropped.h, theme, rng);
    if (cells > fallbackCells) {
      fallback = art;
      fallbackCells = cells;
    }

    const minSide = Math.min(cropped.w, cropped.h);
    if (minSide >= 10 && cells >= Math.max(50, Math.round(cropped.w * cropped.h * 0.3))) {
      return art;
    }
  }

  return fallback as Art;
}

export function artFromMask(
  grid: Uint8Array,
  w: number,
  h: number,
  theme: Theme,
  seed = 1,
): Art {
  const trimmed = crop(grid, w, h);
  return colorize(trimmed.grid, trimmed.w, trimmed.h, theme, mulberry32(seed));
}
