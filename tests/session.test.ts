import { describe, expect, it } from 'vitest';
import { Session, escapeTimeAt } from '../src/game/session';
import { solve } from '../src/game/solver';
import { LEVEL_COUNT, loadLevel, randomLevel } from '../src/game/registry';
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
      expect(['escape', 'win']).toContain(session.tap(head.x, head.y, 0, true).kind);
    }

    expect(session.won).toBe(true);
    expect(session.board.cellsLeft).toBe(0);
    expect(session.moves).toBe(solution?.steps);
    expect(session.misses).toBe(0);
    expect(session.bestCombo).toBe(solution?.steps);
    expect(session.piecesLeft).toBe(0);
  });

  it('closes out every level in the pack', () => {
    for (let index = 1; index <= LEVEL_COUNT; index++) {
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
    const impacts: number[] = [];
    session.onImpact = (flight) => impacts.push(flight.piece.id);

    expect(session.tap(1, 2, 0, false).kind).toBe('bounce');
    expect(session.isBusy(0)).toBe(true);
    expect(session.moves).toBe(0);
    expect(session.misses).toBe(1);
    expect(Array.from(session.board.occ)).toEqual(before);

    // The bouncing strand ignores further taps until it is back in place.
    expect(session.tap(1, 2, 10, false).kind).toBe('none');
    expect(session.misses).toBe(1);

    expect(session.update(5000)).toBe(false);
    expect(impacts).toEqual([0]);
    expect(session.isBusy(0)).toBe(false);
    expect(Array.from(session.board.occ)).toEqual(before);
  });

  it('keeps taking taps while other strands are still moving', () => {
    const level = levelOf(4, 4, [single(0, 1, 2, 0), single(1, 1, 1, 0), single(2, 3, 3, 1)]);
    const session = new Session(level, 'head-ray', 0);

    expect(session.tap(1, 2, 0, false).kind).toBe('bounce');
    expect(session.tap(1, 1, 5, false).kind).toBe('escape');
    expect(session.tap(3, 3, 10, false).kind).toBe('escape');
    expect(session.flights).toHaveLength(3);
    expect(session.moves).toBe(2);

    // The blocker is gone, so once the first strand is back it can leave too.
    session.update(5000);
    expect(session.tap(1, 2, 5000, false).kind).toBe('win');
    expect(session.won).toBe(true);
  });

  it('frees the cells at once and lets the strand keep flying', () => {
    const level = levelOf(3, 3, [single(0, 1, 2, 1)]);
    const session = new Session(level, 'head-ray', 0);
    expect(session.tap(1, 2, 0, false).kind).toBe('win');
    expect(session.board.cellsLeft).toBe(0);
    expect(session.won).toBe(true);
    expect(session.update(60)).toBe(true);
    expect(session.flights[0].offset).toBeGreaterThan(0);
    expect(session.update(5000)).toBe(false);
    expect(session.flights).toHaveLength(0);
  });

  it('skips the flight entirely with reduced motion', () => {
    const level = levelOf(3, 3, [single(0, 1, 2, 1)]);
    const session = new Session(level, 'head-ray', 0);
    expect(session.tap(1, 2, 0, true).kind).toBe('win');
    expect(session.flights).toHaveLength(0);
  });

  it('counts a streak and resets it on a blocked tap', () => {
    const level = levelOf(5, 5, [
      single(0, 0, 0, 0),
      single(1, 2, 0, 0),
      single(2, 4, 2, 0),
      single(3, 4, 0, 0),
      single(4, 0, 4, 2),
    ]);
    const session = new Session(level, 'head-ray', 0);
    session.tap(0, 0, 0, true);
    session.tap(2, 0, 0, true);
    expect(session.combo).toBe(2);
    expect(session.tap(4, 2, 0, true).kind).toBe('bounce');
    expect(session.combo).toBe(0);
    expect(session.bestCombo).toBe(2);
    session.update(1000);
    session.tap(4, 0, 1000, true);
    expect(session.combo).toBe(1);
    expect(session.bestCombo).toBe(2);
  });

  it('times a point along an escape consistently with its easing', () => {
    const level = levelOf(6, 1, [single(0, 0, 0, 1)]);
    const session = new Session(level, 'head-ray', 0);
    session.tap(0, 0, 0, false);
    const flight = session.flights[0];
    const at = escapeTimeAt(flight, 3);
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(flight.forwardMs);
    session.update(at);
    expect(flight.offset).toBeCloseTo(3, 1);
  });

  it('stops the clock when the board is cleared', () => {
    const level = levelOf(3, 3, [single(0, 1, 2, 1)]);
    const session = new Session(level, 'head-ray', 100);
    session.tap(1, 2, 600, true);
    expect(session.elapsedMs(9000)).toBe(500);
  });

  it('offers a hint only when a piece can actually fly', () => {
    const level = levelOf(3, 3, [single(0, 1, 1, 0), single(1, 1, 0, 2)]);
    const session = new Session(level, 'head-ray', 0);
    expect(session.hint()).toBeNull();
  });
});
