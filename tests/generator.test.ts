import { describe, expect, it } from 'vitest';
import { artOfLevel, generateLevel, splitArt } from '../src/game/generator';
import { mulberry32 } from '../src/game/rng';
import { createBoard, isMovable, removePiece } from '../src/game/rules';
import { solve } from '../src/game/solver';
import type { Art, Piece } from '../src/game/types';
import { PICTURES, pictureArt } from '../src/art/pictures';

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

/** Cycles through the picture library at a spread of grid sizes. */
function sampleArt(seed: number): Art {
  return pictureArt(PICTURES[seed % PICTURES.length], 12 + (seed % 8) * 3);
}

describe('splitArt', () => {
  it('covers every art cell exactly once when no holes are cut', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const art = sampleArt(seed);
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

  it('never grows a strand straight ahead of its own head', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const art = sampleArt(seed);
      for (const piece of splitArt(art, { minLen: 3, maxLen: 9 }, mulberry32(seed * 3))) {
        const head = piece.cells[0];
        for (const cell of piece.cells.slice(1)) {
          const ahead =
            piece.dir === 0
              ? cell.x === head.x && cell.y < head.y
              : piece.dir === 2
                ? cell.x === head.x && cell.y > head.y
                : piece.dir === 1
                  ? cell.y === head.y && cell.x > head.x
                  : cell.y === head.y && cell.x < head.x;
          expect(ahead).toBe(false);
        }
      }
    }
  });

  it('carves in an order that is a real solution', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const art = sampleArt(seed);
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
      const level = generateLevel(
        sampleArt(seed * 31),
        { minLen: 3, maxLen: 9, holeRatio: seed % 4 === 0 ? 0.02 : 0 },
        { id: `t${seed}`, name: 't', seed },
      );
      const result = solve(level, 'swept');
      expect(result, `seed ${seed}`).not.toBeNull();
      expect(result?.steps).toBeGreaterThan(0);
      expect(result?.initialMovable).toBeGreaterThan(0);
    }
  });

  it('rebuilds the picture a level was cut from', () => {
    const art = pictureArt(PICTURES[0], 16);
    const level = generateLevel(art, { minLen: 3, maxLen: 6, holeRatio: 0 }, { id: 'a', name: 'a', seed: 9 });
    const rebuilt = artOfLevel(level);
    expect(rebuilt.w).toBe(art.w);
    expect(rebuilt.h).toBe(art.h);
    expect(Array.from(rebuilt.color)).toEqual(Array.from(art.color));
  });
});
