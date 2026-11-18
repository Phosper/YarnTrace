import { DIRS, type Dir, type Piece } from '../game/types';

/** The colours one cell of yarn is built from. */
export interface Tones {
  body: string;
  edge: string;
  hi: string;
  arrow: string;
  arrowEdge: string;
}

/** Strand geometry in cell units; shared by the cached tiles and the live strands. */
export const OUTER = 0.92;
export const BODY = 0.8;
const HI = 0.17;
const HI_SHIFT = 0.13;
const SHADOW_SHIFT = 0.055;
const SHADOW = 'rgba(52, 38, 104, 0.22)';

function rgbOf(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(hex: string, towards: [number, number, number], amount: number): string {
  const [r, g, b] = rgbOf(hex);
  const to = (v: number, t: number): number => Math.round(v + (t - v) * amount);
  return `rgb(${to(r, towards[0])}, ${to(g, towards[1])}, ${to(b, towards[2])})`;
}

export function tonesOf(hex: string): Tones {
  const [r, g, b] = rgbOf(hex);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const pale = luma > 0.74;
  return {
    body: hex,
    edge: mix(hex, [44, 30, 88], pale ? 0.24 : 0.4),
    // Dark yarn gets a quieter sheen so it does not read as a white stripe.
    hi: mix(hex, [255, 255, 255], pale ? 0.75 : 0.16 + luma * 0.34),
    arrow: pale ? '#4a4168' : '#ffffff',
    arrowEdge: pale ? 'rgba(255, 255, 255, 0.7)' : 'rgba(40, 26, 84, 0.55)',
  };
}

type Layer = { width: number; dx: number; dy: number; color: (t: Tones) => string };

const LAYERS: Layer[] = [
  { width: OUTER, dx: 0, dy: SHADOW_SHIFT, color: () => SHADOW },
  { width: OUTER, dx: 0, dy: 0, color: (t) => t.edge },
  { width: BODY, dx: 0, dy: 0, color: (t) => t.body },
  { width: HI, dx: -HI_SHIFT, dy: -HI_SHIFT, color: (t) => t.hi },
];

/**
 * Paints one cell of a resting strand into a unit square: `links` has a bit
 * per direction the yarn continues in, so neighbouring tiles join seamlessly.
 */
export function paintCell(ctx: CanvasRenderingContext2D, tones: Tones, links: number, head: Dir | -1): void {
  const arms: Dir[] = [];
  for (let d = 0; d < 4; d++) if (links & (1 << d)) arms.push(d as Dir);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const layer of LAYERS) {
    ctx.beginPath();
    if (arms.length === 0) {
      ctx.moveTo(0.5 + layer.dx, 0.5 + layer.dy);
      ctx.lineTo(0.5001 + layer.dx, 0.5 + layer.dy);
    } else {
      const [ax, ay] = DIRS[arms[0]];
      ctx.moveTo(0.5 + ax * 0.9 + layer.dx, 0.5 + ay * 0.9 + layer.dy);
      ctx.lineTo(0.5 + layer.dx, 0.5 + layer.dy);
      if (arms.length > 1) {
        const [bx, by] = DIRS[arms[1]];
        ctx.lineTo(0.5 + bx * 0.9 + layer.dx, 0.5 + by * 0.9 + layer.dy);
      }
    }
    ctx.lineWidth = layer.width;
    ctx.strokeStyle = layer.color(tones);
    ctx.stroke();
  }

  if (head !== -1) paintArrow(ctx, 0.5, 0.5, head, tones);
}

export function paintArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: Dir,
  tones: Tones,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((dir * Math.PI) / 2);
  ctx.beginPath();
  ctx.moveTo(0, -0.28);
  ctx.lineTo(0.245, 0.15);
  ctx.lineTo(-0.245, 0.15);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 0.13;
  ctx.strokeStyle = tones.arrowEdge;
  ctx.stroke();
  ctx.lineWidth = 0.05;
  ctx.strokeStyle = tones.arrow;
  ctx.stroke();
  ctx.fillStyle = tones.arrow;
  ctx.fill();
  ctx.restore();
}

/** Centre line of a resting piece, tail to head, in cell units. */
export function tracePiece(ctx: CanvasRenderingContext2D, piece: Piece): void {
  const cells = piece.cells;
  const last = cells[cells.length - 1];
  ctx.moveTo(last.x + 0.5, last.y + 0.5);
  if (cells.length === 1) ctx.lineTo(last.x + 0.5001, last.y + 0.5);
  for (let i = cells.length - 2; i >= 0; i--) ctx.lineTo(cells[i].x + 0.5, cells[i].y + 0.5);
}

/**
 * Draws a strand that has slid `offset` cells head-first along its own track:
 * the body follows the path the head already took, then runs straight out
 * along the arrow. At offset 0 it matches the cached tiles exactly.
 */
export function drawStrand(
  ctx: CanvasRenderingContext2D,
  piece: Piece,
  tones: readonly Tones[],
  offset: number,
): void {
  const cells = piece.cells;
  const n = cells.length;
  const [dx, dy] = DIRS[piece.dir];
  const head = cells[0];

  const at = (u: number): [number, number] => {
    if (u >= n - 1) {
      const k = u - (n - 1);
      return [head.x + 0.5 + dx * k, head.y + 0.5 + dy * k];
    }
    const clamped = Math.max(0, u);
    const k = Math.floor(clamped);
    const f = clamped - k;
    const a = cells[n - 1 - k];
    const b = cells[n - 2 - k];
    return [a.x + 0.5 + (b.x - a.x) * f, a.y + 0.5 + (b.y - a.y) * f];
  };

  const start = offset;
  const end = offset + n - 1;
  const [tailX, tailY] = at(start);
  const [headX, headY] = at(end);
  const tailTones = tones[piece.colors[n - 1]];
  const headTones = tones[piece.colors[0]];

  ctx.lineCap = 'butt';
  ctx.lineJoin = 'round';

  for (const layer of LAYERS) {
    ctx.save();
    ctx.translate(layer.dx, layer.dy);
    ctx.lineWidth = layer.width;

    ctx.fillStyle = layer.color(tailTones);
    ctx.beginPath();
    ctx.arc(tailX, tailY, layer.width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = layer.color(headTones);
    ctx.beginPath();
    ctx.arc(headX, headY, layer.width / 2, 0, Math.PI * 2);
    ctx.fill();

    for (let i = n - 1; i >= 0; i--) {
      const mid = n - 1 - i + offset;
      let lo = Math.max(start, mid - 0.5);
      let hi = Math.min(end, mid + 0.5);
      if (hi <= lo) continue;
      // A hair of overlap hides the seam between two differently coloured cells.
      if (lo > start) lo -= 0.03;
      if (hi < end) hi += 0.03;

      const [x0, y0] = at(lo);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      for (let k = Math.floor(lo) + 1; k < hi; k++) {
        const [vx, vy] = at(k);
        ctx.lineTo(vx, vy);
      }
      const [x1, y1] = at(hi);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = layer.color(tones[piece.colors[i]]);
      ctx.stroke();
    }
    ctx.restore();
  }

  paintArrow(ctx, headX, headY, piece.dir, headTones);
}
