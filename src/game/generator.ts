import { mulberry32, randInt, type Rng } from './rng';
import { stepsToExit } from './rules';
import { DIRS, type Art, type Dir, type Level, type Piece, type Vec } from './types';

export interface GenOptions {
  minLen?: number;
  maxLen?: number;
  holeRatio?: number;
}

export interface LevelSpec {
  id: string;
  name: string;
  seed: number;
  level?: number;
}

const UNASSIGNED = -2;

interface Candidate {
  x: number;
  y: number;
  dir: Dir;
  weight: number;
}

function rayClear(owner: Int16Array, w: number, h: number, x: number, y: number, dir: Dir): boolean {
  const [dx, dy] = DIRS[dir];
  let cx = x + dx;
  let cy = y + dy;
  while (cx >= 0 && cy >= 0 && cx < w && cy < h) {
    if (owner[cy * w + cx] === UNASSIGNED) return false;
    cx += dx;
    cy += dy;
  }
  return true;
}

function collectCandidates(owner: Int16Array, w: number, h: number): Candidate[] {
  const out: Candidate[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (owner[y * w + x] !== UNASSIGNED) continue;
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
      const edgeWeight = 1 + Math.max(0, 6 - edge) * 0.7;
      for (let d = 0; d < 4; d++) {
        const dir = d as Dir;
        if (!rayClear(owner, w, h, x, y, dir)) continue;
        const [dx, dy] = DIRS[dir];
        const steps = stepsToExit(x, y, dx, dy, w, h);
        out.push({ x, y, dir, weight: edgeWeight * (1 + Math.min(steps, 14) / 20) });
      }
    }
  }
  return out;
}

function takeWeighted<T extends { weight: number }>(items: T[], rng: Rng): T {
  let total = 0;
  for (const item of items) total += item.weight;
  let r = rng() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

/**
 * Peels the art apart in the order the player will clear it: every piece is
 * carved from a cell that can already fly out of the board right now, so the
 * carve order itself is a valid solution. Any non-empty board has at least one
 * such cell (the top-most remaining cell always escapes upwards), so this never
 * dead-ends.
 */
export function splitArt(art: Art, opts: GenOptions = {}, rng: Rng = Math.random): Piece[] {
  const { w, h } = art;
  const minLen = Math.max(1, opts.minLen ?? 3);
  const maxLen = Math.max(minLen, opts.maxLen ?? 8);
  const owner = new Int16Array(w * h);
  let total = 0;

  for (let i = 0; i < owner.length; i++) {
    if (art.color[i] >= 0) {
      owner[i] = UNASSIGNED;
      total++;
    } else {
      owner[i] = -1;
    }
  }

  let holes = Math.round(total * (opts.holeRatio ?? 0));
  let holeGuard = 0;
  while (holes > 0 && holeGuard++ < total * 4) {
    const i = randInt(rng, owner.length);
    if (owner[i] === UNASSIGNED) {
      owner[i] = -1;
      total--;
      holes--;
    }
  }

  const pieces: Piece[] = [];

  while (total > 0) {
    const candidates = collectCandidates(owner, w, h);
    if (candidates.length === 0) break;

    const head = takeWeighted(candidates, rng);
    const id = pieces.length;
    const cells: Vec[] = [{ x: head.x, y: head.y }];
    owner[head.y * w + head.x] = id;

    const target = minLen + randInt(rng, maxLen - minLen + 1);
    while (cells.length < target) {
      const tail = cells[cells.length - 1];
      const options: { x: number; y: number; weight: number }[] = [];
      for (let d = 0; d < 4; d++) {
        if (d === head.dir) continue;
        const nx = tail.x + DIRS[d][0];
        const ny = tail.y + DIRS[d][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (owner[ny * w + nx] !== UNASSIGNED) continue;
        if (!rayClear(owner, w, h, nx, ny, head.dir)) continue;
        const backward = (d + 2) % 4 === head.dir;
        options.push({ x: nx, y: ny, weight: backward ? 6 : 2 });
      }
      if (options.length === 0) break;
      const next = takeWeighted(options, rng);
      owner[next.y * w + next.x] = id;
      cells.push({ x: next.x, y: next.y });
    }

    let settled = false;
    while (cells.length > 0) {
      let clear = true;
      for (const c of cells) {
        if (!rayClear(owner, w, h, c.x, c.y, head.dir)) {
          clear = false;
          break;
        }
      }
      if (clear) {
        settled = true;
        break;
      }
      const removed = cells.pop();
      if (removed) owner[removed.y * w + removed.x] = UNASSIGNED;
    }

    if (!settled) continue;

    total -= cells.length;
    pieces.push({
      id,
      cells,
      dir: head.dir,
      colors: cells.map((c) => art.color[c.y * w + c.x]),
    });
  }

  return pieces;
}

export function generateLevel(art: Art, opts: GenOptions, spec: LevelSpec): Level {
  const rng = mulberry32((spec.seed ^ 0x9e3779b9) >>> 0);
  return {
    id: spec.id,
    name: spec.name,
    w: art.w,
    h: art.h,
    palette: art.palette,
    pieces: splitArt(art, opts, rng),
    meta: { level: spec.level, seed: spec.seed },
  };
}
