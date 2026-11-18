import { attempt, createBoard, findPieceAt, movablePieces, removePiece, type Board } from './rules';
import type { CollisionMode, Level, Piece } from './types';
import type { AnimView } from '../render/boardRenderer';

export type Phase = 'idle' | 'escaping' | 'bouncing';

export interface Motion extends AnimView {
  start: number;
  forward: number;
  forwardMs: number;
  holdMs: number;
  backMs: number;
}

export type TapResult = 'escape' | 'bounce' | 'none' | 'win';

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;
const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

export class Session {
  board: Board;
  phase: Phase = 'idle';
  motion: Motion | null = null;
  moves = 0;
  startedAt: number;
  won = false;
  readonly totalCells: number;

  constructor(
    readonly level: Level,
    private mode: CollisionMode = 'head-ray',
    now = 0,
  ) {
    this.board = createBoard(level);
    this.totalCells = this.board.cellsLeft;
    this.startedAt = now;
  }

  tap(cellX: number, cellY: number, now: number, reduceMotion: boolean): TapResult {
    if (this.phase !== 'idle' || this.won) return 'none';
    const piece = findPieceAt(this.board, cellX, cellY);
    if (!piece) return 'none';

    const result = attempt(this.board, piece, this.mode);
    if (result.escapes) {
      this.phase = 'escaping';
      this.motion = {
        piece,
        dir: piece.dir,
        kind: 'escape',
        offset: 0,
        progress: 0,
        flash: 0,
        blockerId: null,
        start: now,
        forward: result.need + 1.4,
        forwardMs: reduceMotion ? 1 : 210,
        holdMs: 0,
        backMs: 0,
      };
      if (reduceMotion) {
        this.applyEscape(piece);
        this.motion = null;
        this.phase = 'idle';
        return this.won ? 'win' : 'escape';
      }
      return 'escape';
    }

    const forward = Math.max(0.4, result.visualAdvance);
    this.phase = 'bouncing';
    this.motion = {
      piece,
      dir: piece.dir,
      kind: 'bounce',
      offset: 0,
      progress: 0,
      flash: 0,
      blockerId: result.blockerId,
      start: now,
      forward,
      forwardMs: reduceMotion ? 1 : Math.min(320, 100 + forward * 38),
      holdMs: reduceMotion ? 1 : 130,
      backMs: reduceMotion ? 1 : Math.min(340, 120 + forward * 38),
    };
    return 'bounce';
  }

  update(now: number): boolean {
    const m = this.motion;
    if (!m) return false;
    const dt = now - m.start;

    if (m.kind === 'escape') {
      const t = Math.min(1, dt / m.forwardMs);
      m.offset = m.forward * easeOutCubic(t);
      m.progress = t;
      if (t >= 1) {
        this.applyEscape(m.piece);
        this.motion = null;
        this.phase = 'idle';
        return false;
      }
      return true;
    }

    if (dt < m.forwardMs) {
      m.offset = m.forward * easeOutCubic(dt / m.forwardMs);
    } else if (dt < m.forwardMs + m.holdMs) {
      m.offset = m.forward;
      m.flash = Math.min(1, (dt - m.forwardMs) / 90);
    } else {
      const t = Math.min(1, (dt - m.forwardMs - m.holdMs) / m.backMs);
      m.offset = m.forward * (1 - easeInOutCubic(t));
      m.flash = Math.max(0, 1 - t * 1.6);
      if (t >= 1) {
        this.motion = null;
        this.phase = 'idle';
        return false;
      }
    }
    return true;
  }

  private applyEscape(piece: Piece): void {
    removePiece(this.board, piece);
    this.moves++;
    if (this.board.cellsLeft === 0) this.won = true;
  }

  hint(): Piece | null {
    if (this.phase !== 'idle' || this.won) return null;
    return movablePieces(this.board, this.mode)[0] ?? null;
  }

  get piecesLeft(): number {
    let count = 0;
    for (const piece of this.board.pieces) if (piece) count++;
    return count;
  }

  get totalPieces(): number {
    return this.level.pieces.length;
  }

  get elapsedMs(): number {
    return Math.max(0, performance.now() - this.startedAt);
  }
}
