import {
  attempt,
  createBoard,
  findPieceAt,
  movablePieces,
  removePiece,
  stepsToExit,
  type Board,
} from './rules';
import { clamp } from './rng';
import { DIRS, type CollisionMode, type Level, type Piece } from './types';

export type FlightKind = 'escape' | 'bounce';

/** One strand in motion. The strand slides head-first along its own path. */
export interface Flight {
  piece: Piece;
  kind: FlightKind;
  start: number;
  /** Cells the head travels before it is gone (escape) or stopped (bounce). */
  reach: number;
  forwardMs: number;
  holdMs: number;
  backMs: number;
  /** Current head advance in cells. */
  offset: number;
  /** 0..1 through the whole animation. */
  progress: number;
  /** 0..1 strength of the red flash on the blocker. */
  flash: number;
  blockerId: number | null;
  impacted: boolean;
}

export type TapResult =
  | { kind: 'none' }
  | { kind: 'escape' | 'win' | 'bounce'; piece: Piece };

const launch = (t: number): number => 0.12 * t + 0.88 * t * t * t;
const easeInQuad = (t: number): number => t * t;

/** Milliseconds into an escape at which the head has advanced `cells`. */
export function escapeTimeAt(flight: Flight, cells: number): number {
  const target = clamp(cells / flight.reach, 0, 1);
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (launch(mid) < target) lo = mid;
    else hi = mid;
  }
  return hi * flight.forwardMs;
}
const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

export class Session {
  board: Board;
  flights: Flight[] = [];
  moves = 0;
  misses = 0;
  combo = 0;
  bestCombo = 0;
  won = false;
  startedAt: number;
  finishedAt: number | null = null;
  /** Called once when a blocked strand reaches whatever stopped it. */
  onImpact: ((flight: Flight) => void) | null = null;
  private busy = new Set<number>();

  constructor(
    readonly level: Level,
    private mode: CollisionMode = 'head-ray',
    now = 0,
  ) {
    this.board = createBoard(level);
    this.startedAt = now;
  }

  /**
   * Taps never queue behind an animation: an escaping strand leaves the board
   * state at once and only its picture keeps flying, so the next tap is judged
   * against the board as it will be.
   */
  tap(cellX: number, cellY: number, now: number, reduceMotion: boolean): TapResult {
    if (this.won) return { kind: 'none' };
    const piece = findPieceAt(this.board, cellX, cellY);
    if (!piece || this.busy.has(piece.id)) return { kind: 'none' };

    const result = attempt(this.board, piece, this.mode);
    if (result.escapes) {
      removePiece(this.board, piece);
      this.moves++;
      this.combo++;
      if (this.combo > this.bestCombo) this.bestCombo = this.combo;
      if (this.board.cellsLeft === 0) {
        this.won = true;
        this.finishedAt = now;
      }
      if (!reduceMotion) {
        const head = piece.cells[0];
        const [dx, dy] = DIRS[piece.dir];
        const reach =
          stepsToExit(head.x, head.y, dx, dy, this.board.w, this.board.h) + piece.cells.length + 0.2;
        this.flights.push({
          piece,
          kind: 'escape',
          start: now,
          reach,
          forwardMs: clamp(200 + reach * 15, 240, 480),
          holdMs: 0,
          backMs: 0,
          offset: 0,
          progress: 0,
          flash: 0,
          blockerId: null,
          impacted: false,
        });
      }
      return { kind: this.won ? 'win' : 'escape', piece };
    }

    this.misses++;
    this.combo = 0;
    this.busy.add(piece.id);
    const travel = result.travel;
    this.flights.push({
      piece,
      kind: 'bounce',
      start: now,
      reach: reduceMotion ? 0 : travel + 0.2,
      forwardMs: reduceMotion ? 0 : clamp(90 + travel * 26, 110, 380),
      holdMs: reduceMotion ? 200 : 90,
      backMs: reduceMotion ? 0 : clamp(150 + travel * 30, 170, 420),
      offset: 0,
      progress: 0,
      flash: 0,
      blockerId: result.blockerId,
      impacted: false,
    });
    return { kind: 'bounce', piece };
  }

  /** Advances every strand in flight; returns true while anything still moves. */
  update(now: number): boolean {
    if (this.flights.length === 0) return false;
    const alive: Flight[] = [];

    for (const f of this.flights) {
      const dt = now - f.start;

      if (f.kind === 'escape') {
        const t = clamp(dt / f.forwardMs, 0, 1);
        f.progress = t;
        f.offset = f.reach * launch(t);
        if (t < 1) alive.push(f);
        continue;
      }

      const total = f.forwardMs + f.holdMs + f.backMs;
      f.progress = total > 0 ? clamp(dt / total, 0, 1) : 1;
      if (dt < f.forwardMs) {
        f.offset = f.reach * easeInQuad(dt / f.forwardMs);
      } else {
        if (!f.impacted) {
          f.impacted = true;
          this.onImpact?.(f);
        }
        if (dt < f.forwardMs + f.holdMs) {
          f.offset = f.reach;
          f.flash = 1;
        } else {
          const t = f.backMs > 0 ? clamp((dt - f.forwardMs - f.holdMs) / f.backMs, 0, 1) : 1;
          f.offset = f.reach * (1 - easeOutCubic(t));
          f.flash = Math.max(0, 1 - t * 1.4);
          if (t >= 1) {
            this.busy.delete(f.piece.id);
            continue;
          }
        }
      }
      alive.push(f);
    }

    this.flights = alive;
    return alive.length > 0;
  }

  /** True while the piece is mid-bounce and drawn by its flight, not the board. */
  isBusy(pieceId: number): boolean {
    return this.busy.has(pieceId);
  }

  hint(): Piece | null {
    if (this.won) return null;
    for (const piece of movablePieces(this.board, this.mode)) {
      if (!this.busy.has(piece.id)) return piece;
    }
    return null;
  }

  get piecesLeft(): number {
    return this.level.pieces.length - this.moves;
  }

  get totalPieces(): number {
    return this.level.pieces.length;
  }

  elapsedMs(now: number): number {
    return Math.max(0, (this.finishedAt ?? now) - this.startedAt);
  }
}
