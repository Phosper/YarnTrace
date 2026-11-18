import { DIRS, type Dir, type Piece } from '../game/types';

/** Fill and outline for the arrow on a head cell, chosen to read on that cell's colour. */
export interface ArrowInk {
  fill: string;
  edge: string;
}

export function arrowInk(hex: string): ArrowInk {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  const luma = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luma > 0.72
    ? { fill: '#3a3350', edge: 'rgba(255, 255, 255, 0.85)' }
    : { fill: '#ffffff', edge: 'rgba(34, 22, 78, 0.7)' };
}

/** A block arrow (shaft and head) centred on (x, y) in cell units. */
export function paintArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: Dir,
  ink: ArrowInk,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((dir * Math.PI) / 2);
  ctx.beginPath();
  ctx.moveTo(0, -0.36);
  ctx.lineTo(0.27, -0.05);
  ctx.lineTo(0.1, -0.05);
  ctx.lineTo(0.1, 0.33);
  ctx.lineTo(-0.1, 0.33);
  ctx.lineTo(-0.1, -0.05);
  ctx.lineTo(-0.27, -0.05);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 0.11;
  ctx.strokeStyle = ink.edge;
  ctx.stroke();
  ctx.fillStyle = ink.fill;
  ctx.fill();
  ctx.restore();
}

/**
 * Centre line of a resting piece, tail to head, in cell units. Stroked with
 * square caps and mitred joins at width 1 it covers exactly the piece's cells.
 */
export function tracePiece(ctx: CanvasRenderingContext2D, piece: Piece): void {
  const cells = piece.cells;
  const last = cells[cells.length - 1];
  ctx.moveTo(last.x + 0.5, last.y + 0.5);
  if (cells.length === 1) {
    const [dx, dy] = DIRS[piece.dir];
    ctx.lineTo(last.x + 0.5 + dx * 0.001, last.y + 0.5 + dy * 0.001);
  }
  for (let i = cells.length - 2; i >= 0; i--) ctx.lineTo(cells[i].x + 0.5, cells[i].y + 0.5);
}

/**
 * Draws a piece that has slid `offset` cells head-first along its own track:
 * the body follows the path the head already took, then runs straight out
 * along the arrow. At offset 0 it sits exactly on its cells.
 */
export function drawSliding(
  ctx: CanvasRenderingContext2D,
  piece: Piece,
  palette: readonly string[],
  inks: readonly ArrowInk[],
  offset: number,
): void {
  const cells = piece.cells;
  const n = cells.length;
  const [dx, dy] = DIRS[piece.dir];
  const head = cells[0];
  const tail = cells[n - 1];
  const backX = n > 1 ? tail.x - cells[n - 2].x : -dx;
  const backY = n > 1 ? tail.y - cells[n - 2].y : -dy;

  /** Point at `u` cells along the track, measured from the tail's resting centre. */
  const at = (u: number): [number, number] => {
    if (u >= n - 1) {
      const k = u - (n - 1);
      return [head.x + 0.5 + dx * k, head.y + 0.5 + dy * k];
    }
    if (u <= 0) return [tail.x + 0.5 - backX * u, tail.y + 0.5 - backY * u];
    const k = Math.floor(u);
    const f = u - k;
    const a = cells[n - 1 - k];
    const b = cells[n - 2 - k];
    return [a.x + 0.5 + (b.x - a.x) * f, a.y + 0.5 + (b.y - a.y) * f];
  };

  const span = (lo: number, hi: number): void => {
    const [x0, y0] = at(lo);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    for (let k = Math.floor(lo) + 1; k < hi; k++) {
      const [vx, vy] = at(k);
      ctx.lineTo(vx, vy);
    }
    const [x1, y1] = at(hi);
    ctx.lineTo(x1, y1);
  };

  const start = offset - 0.5;
  const end = offset + n - 0.5;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';

  // A soft shadow underneath lifts the moving piece off the board.
  ctx.save();
  ctx.translate(0, 0.07);
  span(start, end);
  ctx.lineWidth = 1.08;
  ctx.strokeStyle = 'rgba(44, 30, 96, 0.3)';
  ctx.stroke();
  ctx.restore();

  ctx.lineWidth = 1;
  for (let i = n - 1; i >= 0; i--) {
    const mid = n - 1 - i + offset;
    // A hair of overlap hides the seam between two differently coloured cells.
    span(mid - 0.5 - (i < n - 1 ? 0.02 : 0), mid + 0.5 + (i > 0 ? 0.02 : 0));
    ctx.strokeStyle = palette[piece.colors[i]];
    ctx.stroke();
  }

  const [headX, headY] = at(offset + n - 1);
  paintArrow(ctx, headX, headY, piece.dir, inks[piece.colors[0]]);
}
