import { describe, expect, it } from 'vitest';
import { PICTURES, pictureArt } from '../src/art/pictures';
import { E, P, R, clip, pair, rasterize, toneGrid } from '../src/art/raster';
import { LEVEL_COUNT, levelArt, levelSize, loadLevel, randomLevel } from '../src/game/registry';
import { starsFor } from '../src/game/score';
import type { Art } from '../src/game/types';

function cellsOf(art: Art): number {
  let n = 0;
  for (let i = 0; i < art.color.length; i++) if (art.color[i] >= 0) n++;
  return n;
}

describe('rasterize', () => {
  it('fills a square edge to edge at the requested size', () => {
    const grid = rasterize([R('r', 10, 10, 80, 80)], 16);
    expect(grid.w).toBe(16);
    expect(grid.h).toBe(16);
    expect(grid.keys.every((k) => k === 'r')).toBe(true);
  });

  it('keeps the aspect ratio of a wide shape', () => {
    const grid = rasterize([R('b', 0, 40, 100, 25)], 20);
    expect(grid.w).toBe(20);
    expect(grid.h).toBe(5);
  });

  it('lets later shapes cover earlier ones and erasers cut holes', () => {
    const grid = rasterize([R('r', 0, 0, 100, 100), E('y', 50, 50, 30), E('.', 50, 50, 12)], 20);
    const at = (x: number, y: number): string => grid.keys[y * grid.w + x];
    expect(at(0, 0)).toBe('r');
    expect(at(10, 4)).toBe('y');
    expect(at(10, 10)).toBe('');
  });

  it('clips a shape to a rectangle', () => {
    const grid = rasterize([clip(E('g', 50, 50, 40), 0, 0, 100, 50)], 20);
    expect(grid.w).toBe(20);
    expect(grid.h).toBe(10);
  });

  it('mirrors a pair across the centre line', () => {
    const grid = rasterize([...pair(P('k', 10, 10, 30, 10, 20, 40))], 24);
    for (let y = 0; y < grid.h; y++) {
      for (let x = 0; x < grid.w; x++) {
        expect(grid.keys[y * grid.w + x]).toBe(grid.keys[y * grid.w + (grid.w - 1 - x)]);
      }
    }
  });
});

describe('toneGrid', () => {
  it('darkens the silhouette and keeps the inside on the base colour', () => {
    const art = toneGrid(rasterize([R('r', 0, 0, 100, 100)], 12));
    const rim = art.color[0];
    const inside = art.color[5 * art.w + 5];
    expect(rim).not.toBe(inside);
    expect(art.palette[inside]).toBe('#f4505e');
    for (let x = 0; x < art.w; x++) expect(art.color[x]).toBe(rim);
  });

  it('adds a bevel only on larger grids', () => {
    const small = toneGrid(rasterize([R('r', 0, 0, 100, 100)], 12));
    const large = toneGrid(rasterize([R('r', 0, 0, 100, 100)], 24));
    expect(small.palette).toHaveLength(2);
    expect(large.palette.length).toBeGreaterThan(2);
  });
});

describe('picture library', () => {
  it('has a distinct, named picture for every level', () => {
    expect(PICTURES).toHaveLength(LEVEL_COUNT);
    expect(new Set(PICTURES.map((p) => p.id)).size).toBe(PICTURES.length);
    expect(new Set(PICTURES.map((p) => p.name)).size).toBe(PICTURES.length);
  });

  it('renders every picture as a usable, multi-coloured grid at any level size', () => {
    for (const picture of PICTURES) {
      for (const size of [12, 20, 32]) {
        const art = pictureArt(picture, size);
        const label = `${picture.id}@${size}`;
        // Thin tips can fall below the coverage threshold and get cropped away.
        expect(Math.max(art.w, art.h), label).toBeLessThanOrEqual(size);
        expect(Math.max(art.w, art.h), label).toBeGreaterThanOrEqual(size - 2);
        expect(Math.min(art.w, art.h), label).toBeGreaterThanOrEqual(size / 2);
        expect(cellsOf(art), label).toBeGreaterThan(size * size * 0.22);
        expect(art.palette.length, label).toBeGreaterThanOrEqual(2);
        for (const c of art.color) expect(c).toBeLessThan(art.palette.length);
      }
    }
  });

  it('is deterministic and cached', () => {
    expect(pictureArt(PICTURES[4], 18)).toBe(pictureArt(PICTURES[4], 18));
    expect(Array.from(levelArt(7).color)).toEqual(Array.from(pictureArt(PICTURES[6], levelSize(7)).color));
  });

  it('grows the grid from 12 cells to 32 across the pack', () => {
    expect(levelSize(1)).toBe(12);
    expect(levelSize(LEVEL_COUNT)).toBe(32);
    for (let i = 2; i <= LEVEL_COUNT; i++) expect(levelSize(i)).toBeGreaterThanOrEqual(levelSize(i - 1));
  });

  it('names levels after their picture and leaves no holes in it', () => {
    const level = loadLevel(15);
    expect(level.name).toBe(PICTURES[14].name);
    const covered = level.pieces.reduce((sum, piece) => sum + piece.cells.length, 0);
    expect(covered).toBe(cellsOf(levelArt(15)));
  });

  it('reproduces a random level from its seed', () => {
    const a = randomLevel(424242);
    const b = randomLevel(424242);
    expect(a.name).toBe(b.name);
    expect(a.pieces).toEqual(b.pieces);
    expect(PICTURES.some((p) => p.name === a.name)).toBe(true);
  });
});

describe('starsFor', () => {
  it('forgives a slip or two and scales with the board', () => {
    expect(starsFor(0, 20)).toBe(3);
    expect(starsFor(2, 20)).toBe(3);
    expect(starsFor(3, 20)).toBe(2);
    expect(starsFor(5, 20)).toBe(2);
    expect(starsFor(6, 20)).toBe(1);
    expect(starsFor(10, 100)).toBe(3);
    expect(starsFor(11, 100)).toBe(2);
    expect(starsFor(25, 100)).toBe(2);
    expect(starsFor(26, 100)).toBe(1);
  });
});
