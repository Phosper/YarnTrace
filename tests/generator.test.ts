import { describe, expect, it } from 'vitest';
import { generateLevel, splitArt } from '../src/game/generator';
import { mulberry32 } from '../src/game/rng';
import { createBoard, isMovable, removePiece } from '../src/game/rules';
import { solve } from '../src/game/solver';
import type { Art, Piece } from '../src/game/types';
import { generateArt } from '../src/art/procedural';
import { TEMPLATES, templateArt } from '../src/art/templates';

function artCells(art: Art): number {
  let n = 0;
  for (let i = 0; i < art.color.length; i++) if (art.color[i] >= 0) n++;
  return n;
}

function coveredCells(pieces: Piece[]): number {
  return pieces.reduce((sum, piece) => sum + piece.cells.length, 0);
}

function expectConnected(piece: Piece): void {
  for (let i = 1; i < piece.cells.length; i++) {
    const a = piece.cells[i - 1];
    const b = piece.cells[i];
    const dist = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    expect(dist).toBe(1);
  }
}

describe('procedural art', () => {
  it('is deterministic for a seed', () => {
    const a = generateArt(1234, { size: 18 });
    const b = generateArt(1234, { size: 18 });
    expect(a.w).toBe(b.w);
    expect(a.h).toBe(b.h);
    expect(Array.from(a.color)).toEqual(Array.from(b.color));
    expect(a.palette).toEqual(b.palette);
  });

  it('produces a sane mask', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const art = generateArt(seed, { size: 16 });
      expect(art.w).toBeGreaterThanOrEqual(10);
      expect(art.h).toBeGreaterThanOrEqual(10);
      expect(artCells(art)).toBeGreaterThan(40);
      expect(artCells(art)).toBeLessThan(art.w * art.h);
    }
  });
});

describe('splitArt', () => {
  it('covers every art cell exactly once when no holes are cut', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const art = generateArt(seed, { size: 16 });
      const pieces = splitArt(art, { minLen: 3, maxLen: 7, holeRatio: 0 }, mulberry32(seed));
      expect(coveredCells(pieces)).toBe(artCells(art));

      const seen = new Set<number>();
      for (const piece of pieces) {
        expectConnected(piece);
        for (const cell of piece.cells) {
          const key = cell.y * art.w + cell.x;
          expect(seen.has(key)).toBe(false);
          seen.add(key);
          expect(art.color[key]).toBeGreaterThanOrEqual(0);
          const colorIndex = piece.cells.indexOf(cell);
          expect(piece.colors[colorIndex]).toBe(art.color[key]);
        }
      }
      expect(seen.size).toBe(artCells(art));
    }
  });

  it('carves in an order that is a real solution', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const art = generateArt(seed, { size: 18 });
      const pieces = splitArt(art, { minLen: 3, maxLen: 8, holeRatio: 0.01 }, mulberry32(seed * 7));
      const level = {
        id: 'x',
        name: 'x',
        w: art.w,
        h: art.h,
        palette: art.palette,
        pieces,
        meta: { seed },
      };
      const board = createBoard(level);
      for (const piece of [...pieces].sort((a, b) => a.id - b.id)) {
        expect(isMovable(board, piece, 'swept')).toBe(true);
        removePiece(board, piece);
      }
      expect(board.cellsLeft).toBe(0);
    }
  });

  it('always produces a level the greedy solver can clear', () => {
    for (let seed = 1; seed <= 120; seed++) {
      const size = 12 + (seed % 9) * 3;
      const art = generateArt(seed * 31, { size });
      const level = generateLevel(
        art,
        { minLen: 3, maxLen: 9, holeRatio: seed % 4 === 0 ? 0.02 : 0 },
        { id: `t${seed}`, name: 't', seed },
      );
      const result = solve(level, 'swept');
      expect(result, `seed ${seed}`).not.toBeNull();
      expect(result?.steps).toBeGreaterThan(0);
      expect(result?.initialMovable).toBeGreaterThan(0);
    }
  });

  it('handles every built-in template', () => {
    for (const template of TEMPLATES) {
      const art = templateArt(template.id);
      expect(art, template.id).not.toBeNull();
      const level = generateLevel(
        art as Art,
        { minLen: 3, maxLen: 7, holeRatio: 0 },
        { id: template.id, name: template.name, seed: 5 },
      );
      expect(level.pieces.length).toBeGreaterThan(0);
      expect(solve(level, 'swept'), template.id).not.toBeNull();
    }
  });
});
