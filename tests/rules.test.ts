import { describe, expect, it } from 'vitest';
import { attempt, createBoard, findPieceAt, removePiece, travelDistance } from '../src/game/rules';
import type { Level, Piece } from '../src/game/types';

function makeLevel(w: number, h: number, pieces: Piece[]): Level {
  return { id: 'test', name: 'test', w, h, palette: ['#ffffff'], pieces, meta: { seed: 1 } };
}

const single = (id: number, x: number, y: number, dir: Piece['dir']): Piece => ({
  id,
  cells: [{ x, y }],
  dir,
  colors: [0],
});

describe('travelDistance', () => {
  it('measures the whole way out on an empty board', () => {
    const board = createBoard(makeLevel(5, 5, [single(0, 2, 2, 0)]));
    const result = travelDistance(board, board.pieces[0] as Piece);
    expect(result.need).toBe(3);
    expect(result.travel).toBe(3);
    expect(result.blockerId).toBeNull();
  });

  it('stops right before the blocking piece and reports it', () => {
    const board = createBoard(makeLevel(5, 5, [single(0, 2, 3, 0), single(1, 2, 1, 0)]));
    const head = board.pieces[0] as Piece;
    const result = travelDistance(board, head);
    expect(result.need).toBe(4);
    expect(result.travel).toBe(1);
    expect(result.blockerId).toBe(1);
  });

  it('ignores its own body cells', () => {
    const piece: Piece = {
      id: 0,
      cells: [
        { x: 2, y: 2 },
        { x: 2, y: 3 },
      ],
      dir: 0,
      colors: [0, 0],
    };
    const board = createBoard(makeLevel(5, 5, [piece]));
    const result = travelDistance(board, board.pieces[0] as Piece);
    expect(result.travel).toBe(result.need);
  });

  it('head-ray mode ignores a blocked body ray, swept mode does not', () => {
    const bent: Piece = {
      id: 0,
      cells: [
        { x: 2, y: 2 },
        { x: 1, y: 2 },
      ],
      dir: 0,
      colors: [0, 0],
    };
    const decoy = single(1, 1, 0, 0);
    const board = createBoard(makeLevel(5, 5, [bent, decoy]));

    expect(travelDistance(board, board.pieces[0] as Piece, 'head-ray').travel).toBe(3);
    const swept = travelDistance(board, board.pieces[0] as Piece, 'swept');
    expect(swept.travel).toBe(1);
    expect(swept.blockerId).toBe(1);
  });
});

describe('attempt', () => {
  it('is a pure check: the board is untouched', () => {
    const board = createBoard(makeLevel(4, 4, [single(0, 1, 2, 0), single(1, 1, 1, 0)]));
    const before = Array.from(board.occ);
    const result = attempt(board, board.pieces[0] as Piece);
    expect(result.escapes).toBe(false);
    expect(result.blockerId).toBe(1);
    expect(Array.from(board.occ)).toEqual(before);
  });

  it('does not count a blocked attempt as progress', () => {
    const board = createBoard(makeLevel(3, 3, [single(0, 1, 1, 0), single(1, 1, 0, 1)]));
    attempt(board, board.pieces[0] as Piece);
    expect(board.cellsLeft).toBe(2);
  });
});

describe('removePiece', () => {
  it('frees cells and keeps the index consistent', () => {
    const board = createBoard(makeLevel(3, 3, [single(0, 1, 2, 0), single(1, 0, 0, 1)]));
    const piece = findPieceAt(board, 1, 2) as Piece;
    removePiece(board, piece);
    expect(findPieceAt(board, 1, 2)).toBeNull();
    expect(board.cellsLeft).toBe(1);
    expect(board.pieces[0]).toBeNull();
  });
});
