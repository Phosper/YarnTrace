import { createBoard, isMovable, removePiece } from './rules';
import type { CollisionMode, Level, Piece } from './types';

export interface SolveResult {
  order: number[];
  steps: number;
  initialMovable: number;
  minMovable: number;
}

export function solve(level: Level, mode: CollisionMode = 'swept'): SolveResult | null {
  const board = createBoard(level);
  const order: number[] = [];
  let initialMovable = 0;
  let minMovable = Number.POSITIVE_INFINITY;

  while (board.cellsLeft > 0) {
    const movable = board.pieces.filter(
      (p): p is Piece => p !== null && isMovable(board, p, mode),
    );
    if (movable.length === 0) return null;
    if (order.length === 0) initialMovable = movable.length;
    if (movable.length < minMovable) minMovable = movable.length;

    const piece = movable[0];
    order.push(piece.id);
    removePiece(board, piece);
  }

  return {
    order,
    steps: order.length,
    initialMovable,
    minMovable: minMovable === Number.POSITIVE_INFINITY ? 0 : minMovable,
  };
}
