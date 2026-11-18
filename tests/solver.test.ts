import { describe, expect, it } from 'vitest';
import { solve } from '../src/game/solver';
import type { Level, Piece } from '../src/game/types';

const piece = (id: number, x: number, y: number, dir: Piece['dir']): Piece => ({
  id,
  cells: [{ x, y }],
  dir,
  colors: [0],
});

function makeLevel(w: number, h: number, pieces: Piece[]): Level {
  return { id: 'test', name: 'test', w, h, palette: ['#fff'], pieces, meta: { seed: 1 } };
}

describe('greedySolve', () => {
  it('clears a level that only has one way out at a time', () => {
    const level = makeLevel(3, 3, [piece(0, 0, 0, 0), piece(1, 0, 1, 0), piece(2, 0, 2, 0)]);
    const result = solve(level, 'head-ray');
    expect(result).not.toBeNull();
    expect(result?.order).toEqual([0, 1, 2]);
    expect(result?.initialMovable).toBe(1);
    expect(result?.minMovable).toBe(1);
  });

  it('reports multiple choices when the board is open', () => {
    const level = makeLevel(4, 4, [piece(0, 0, 3, 2), piece(1, 3, 0, 3)]);
    const result = solve(level, 'head-ray');
    expect(result?.initialMovable).toBe(2);
  });

  it('returns null for a level that locks itself', () => {
    const level = makeLevel(3, 3, [piece(0, 1, 1, 0), piece(1, 1, 0, 2)]);
    expect(solve(level, 'head-ray')).toBeNull();
  });

  it('is order independent: any movable piece first is fine', () => {
    const level = makeLevel(4, 3, [piece(0, 0, 0, 0), piece(1, 3, 0, 0)]);
    const first = solve(level, 'head-ray');
    const second = solve(level, 'swept');
    expect(first?.steps).toBe(2);
    expect(second?.steps).toBe(2);
  });
});
