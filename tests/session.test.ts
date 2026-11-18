import { describe, expect, it } from 'vitest';
import { Session } from '../src/game/session';
import { solve } from '../src/game/solver';
import { loadLevel, randomLevel } from '../src/game/registry';
import type { Level, Piece } from '../src/game/types';

const single = (id: number, x: number, y: number, dir: Piece['dir']): Piece => ({
  id,
  cells: [{ x, y }],
  dir,
  colors: [0],
});

const levelOf = (w: number, h: number, pieces: Piece[]): Level => ({
  id: 't',
  name: 't',
  w,
  h,
  palette: ['#ffffff'],
  pieces,
  meta: { seed: 1 },
});

describe('Session', () => {
  it('plays a generated level to the end without getting stuck', () => {
    const level = loadLevel(3);
    const solution = solve(level, 'head-ray');
    expect(solution).not.toBeNull();

    const session = new Session(level, 'head-ray', 0);
    for (const id of solution?.order ?? []) {
      const piece = session.board.pieces[id];
      expect(piece).not.toBeNull();
      const head = (piece as Piece).cells[0];
      expect(['escape', 'win']).toContain(session.tap(head.x, head.y, 0, true));
    }

    expect(session.won).toBe(true);
    expect(session.board.cellsLeft).toBe(0);
    expect(session.moves).toBe(solution?.steps);
  });

  it('closes out every level in the pack', () => {
    for (let index = 1; index <= 40; index++) {
      const level = loadLevel(index);
      const solution = solve(level, 'head-ray');
      expect(solution, `level ${index}`).not.toBeNull();
      const session = new Session(level, 'head-ray', 0);
      for (const id of solution?.order ?? []) {
        const head = (session.board.pieces[id] as Piece).cells[0];
        session.tap(head.x, head.y, 0, true);
      }
      expect(session.won, `level ${index} won`).toBe(true);
    }
  });

  it('closes out random seeds', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const level = randomLevel(seed * 7919);
      const solution = solve(level, 'head-ray');
      expect(solution, `seed ${seed}`).not.toBeNull();
      const session = new Session(level, 'head-ray', 0);
      for (const id of solution?.order ?? []) {
        const head = (session.board.pieces[id] as Piece).cells[0];
        session.tap(head.x, head.y, 0, true);
      }
      expect(session.won, `seed ${seed} won`).toBe(true);
    }
  });

  it('bounces off a blocker and leaves the board untouched', () => {
    const level = levelOf(4, 4, [single(0, 1, 2, 0), single(1, 1, 1, 0)]);
    const session = new Session(level, 'head-ray', 0);
    const before = Array.from(session.board.occ);

    expect(session.tap(1, 2, 0, false)).toBe('bounce');
    expect(session.phase).toBe('bouncing');
    expect(session.moves).toBe(0);
    expect(Array.from(session.board.occ)).toEqual(before);

    expect(session.tap(1, 1, 0, false)).toBe('none');
    expect(session.update(5000)).toBe(false);
    expect(session.phase).toBe('idle');
    expect(Array.from(session.board.occ)).toEqual(before);
  });

  it('runs the escape animation before removing the piece', () => {
    const level = levelOf(3, 3, [single(0, 1, 2, 1)]);
    const session = new Session(level, 'head-ray', 0);
    expect(session.tap(1, 2, 0, false)).toBe('escape');
    expect(session.board.cellsLeft).toBe(1);
    expect(session.update(120)).toBe(true);
    expect(session.board.cellsLeft).toBe(1);
    expect(session.update(400)).toBe(false);
    expect(session.board.cellsLeft).toBe(0);
    expect(session.won).toBe(true);
  });

  it('offers a hint only when a piece can actually fly', () => {
    const level = levelOf(3, 3, [single(0, 1, 1, 0), single(1, 1, 0, 2)]);
    const session = new Session(level, 'head-ray', 0);
    expect(session.hint()).toBeNull();
  });
});
