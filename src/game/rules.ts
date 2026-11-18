import { DIRS, type Attempt, type CollisionMode, type Level, type Piece } from './types';

export interface Board {
  w: number;
  h: number;
  occ: Int16Array;
  color: Int16Array;
  head: Uint8Array;
  pieces: (Piece | null)[];
  cellsLeft: number;
}

export function createBoard(level: Level): Board {
  const { w, h } = level;
  const occ = new Int16Array(w * h);
  const color = new Int16Array(w * h).fill(-1);
  const head = new Uint8Array(w * h);
  const pieces: (Piece | null)[] = new Array(level.pieces.length).fill(null);
  let cellsLeft = 0;

  for (const src of level.pieces) {
    const piece: Piece = {
      id: src.id,
      dir: src.dir,
      cells: src.cells.map((c) => ({ x: c.x, y: c.y })),
      colors: src.colors.slice(),
    };
    pieces[piece.id] = piece;
    piece.cells.forEach((c, i) => {
      const at = c.y * w + c.x;
      occ[at] = piece.id + 1;
      color[at] = piece.colors[i];
      if (i === 0) head[at] = 1;
    });
    cellsLeft += piece.cells.length;
  }

  return { w, h, occ, color, head, pieces, cellsLeft };
}

export function stepsToExit(x: number, y: number, dx: number, dy: number, w: number, h: number): number {
  if (dx === 1) return w - x;
  if (dx === -1) return x + 1;
  if (dy === 1) return h - y;
  return y + 1;
}

interface Probe {
  travel: number;
  blockerId: number | null;
}

export interface TravelResult {
  travel: number;
  need: number;
  blockerId: number | null;
}

export function travelDistance(
  board: Board,
  piece: Piece,
  mode: CollisionMode = 'head-ray',
): TravelResult {
  const [dx, dy] = DIRS[piece.dir];
  let need = 0;
  for (const c of piece.cells) {
    const d = stepsToExit(c.x, c.y, dx, dy, board.w, board.h);
    if (d > need) need = d;
  }

  const probe = (cx: number, cy: number): Probe => {
    for (let k = 1; k <= need; k++) {
      const x = cx + dx * k;
      const y = cy + dy * k;
      if (x < 0 || y < 0 || x >= board.w || y >= board.h) break;
      const v = board.occ[y * board.w + x];
      if (v !== 0 && v !== piece.id + 1) {
        return { travel: k - 1, blockerId: v - 1 };
      }
    }
    return { travel: need, blockerId: null };
  };

  let best = probe(piece.cells[0].x, piece.cells[0].y);
  if (mode === 'swept') {
    for (let i = 1; i < piece.cells.length; i++) {
      const r = probe(piece.cells[i].x, piece.cells[i].y);
      if (r.travel < best.travel) best = r;
    }
  }

  return {
    travel: best.travel,
    need,
    blockerId: best.travel < need ? best.blockerId : null,
  };
}

export function isMovable(board: Board, piece: Piece, mode: CollisionMode = 'head-ray'): boolean {
  const { travel, need } = travelDistance(board, piece, mode);
  return travel >= need;
}

export function movablePieces(board: Board, mode: CollisionMode = 'head-ray'): Piece[] {
  const out: Piece[] = [];
  for (const p of board.pieces) {
    if (p && isMovable(board, p, mode)) out.push(p);
  }
  return out;
}

export function attempt(board: Board, piece: Piece, mode: CollisionMode = 'head-ray'): Attempt {
  const { travel, need, blockerId } = travelDistance(board, piece, mode);
  return {
    pieceId: piece.id,
    escapes: travel >= need,
    travel,
    need,
    blockerId,
    visualAdvance: Math.min(travel, 6),
  };
}

export function findPieceAt(board: Board, x: number, y: number): Piece | null {
  if (x < 0 || y < 0 || x >= board.w || y >= board.h) return null;
  const v = board.occ[y * board.w + x];
  return v === 0 ? null : board.pieces[v - 1];
}

export function removePiece(board: Board, piece: Piece): void {
  if (!board.pieces[piece.id]) return;
  for (const c of piece.cells) {
    const at = c.y * board.w + c.x;
    board.occ[at] = 0;
    board.head[at] = 0;
  }
  board.pieces[piece.id] = null;
  board.cellsLeft -= piece.cells.length;
}
