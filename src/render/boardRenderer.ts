import { artOfLevel } from '../game/generator';
import type { Board } from '../game/rules';
import type { Flight } from '../game/session';
import type { Art, Dir, Level } from '../game/types';
import type { Camera } from './camera';
import type { Effects } from './effects';
import { SpriteCache } from './sprites';
import { OUTER, drawStrand, tracePiece } from './strand';

export interface DrawState {
  now: number;
  flights: readonly Flight[];
  isBusy: (pieceId: number) => boolean;
  hintId: number | null;
  shakeX: number;
  shakeY: number;
  /** Milliseconds since the finished picture started popping back in; null while playing. */
  reveal: number | null;
}

/** How strongly the picture shows through under and between the strands. */
const UNDERLAY = 0.38;
const REVEAL_STEP = 24;
const REVEAL_POP = 260;

const easeOutBack = (t: number): number => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export class BoardRenderer {
  private ctx: CanvasRenderingContext2D;
  private sprites: SpriteCache | null = null;
  private art: Art | null = null;
  /** The picture at one pixel per cell; scaled up without smoothing it is the underlay. */
  private underlay: HTMLCanvasElement | null = null;
  private links = new Uint8Array(0);
  private heads = new Int8Array(0);
  private backdrop = document.createElement('canvas');
  private dpr = 1;
  private cssW = 0;
  private cssH = 0;
  /** How long the win reveal takes for the current level. */
  revealMs = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('canvas 2d unavailable');
    this.ctx = ctx;
  }

  setLevel(level: Level): void {
    const { w, h } = level;
    const art = artOfLevel(level);
    this.art = art;
    this.sprites = new SpriteCache(level.palette);

    this.links = new Uint8Array(w * h);
    this.heads = new Int8Array(w * h).fill(-1);
    for (const piece of level.pieces) {
      const cells = piece.cells;
      this.heads[cells[0].y * w + cells[0].x] = piece.dir;
      for (let i = 1; i < cells.length; i++) {
        const a = cells[i - 1];
        const b = cells[i];
        const dir = b.x > a.x ? 1 : b.x < a.x ? 3 : b.y > a.y ? 2 : 0;
        this.links[a.y * w + a.x] |= 1 << dir;
        this.links[b.y * w + b.x] |= 1 << ((dir + 2) % 4);
      }
    }

    const underlay = document.createElement('canvas');
    underlay.width = w;
    underlay.height = h;
    const uctx = underlay.getContext('2d');
    let far = 0;
    if (uctx) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const c = art.color[y * w + x];
          if (c < 0) continue;
          uctx.fillStyle = art.palette[c];
          uctx.fillRect(x, y, 1, 1);
          far = Math.max(far, Math.hypot(x - (w - 1) / 2, y - (h - 1) / 2));
        }
      }
    }
    this.underlay = underlay;
    this.revealMs = far * REVEAL_STEP + REVEAL_POP;
  }

  resize(cssW: number, cssH: number): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.cssW = cssW;
    this.cssH = cssH;
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    this.paintBackdrop();
  }

  /** The backdrop is all soft gradients, so a quarter-size copy is plenty. */
  private paintBackdrop(): void {
    const w = Math.max(2, Math.round(this.cssW / 4));
    const h = Math.max(2, Math.round(this.cssH / 4));
    this.backdrop.width = w;
    this.backdrop.height = h;
    const ctx = this.backdrop.getContext('2d');
    if (!ctx) return;
    const base = ctx.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, '#f6f1ff');
    base.addColorStop(1, '#e3e8fc');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    const glow = (x: number, y: number, r: number, color: string): void => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    };
    const reach = Math.max(w, h);
    glow(w * 0.08, h * 0.06, reach * 0.62, 'rgba(255, 178, 214, 0.42)');
    glow(w * 0.96, h * 0.9, reach * 0.66, 'rgba(142, 196, 255, 0.4)');
    glow(w * 0.9, h * 0.12, reach * 0.4, 'rgba(255, 228, 160, 0.3)');
  }

  draw(board: Board, camera: Camera, effects: Effects, state: DrawState): void {
    const ctx = this.ctx;
    const { dpr, cssW, cssH } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.backdrop, 0, 0, cssW, cssH);

    const sprites = this.sprites;
    const art = this.art;
    const underlay = this.underlay;
    const tile = camera.tile;
    if (!sprites || !art || !underlay || tile < 2) return;

    const { w, h } = board;
    // Tile edges are snapped to device pixels so neighbouring tiles abut without seams.
    const snap = (v: number): number => Math.round(v * dpr) / dpr;
    const left = snap(camera.panX);
    const top = snap(camera.panY);
    const right = snap(camera.panX + w * tile);
    const bottom = snap(camera.panY + h * tile);

    ctx.save();
    ctx.translate(state.shakeX, state.shakeY);

    const pad = Math.min(22, tile * 0.7);
    const radius = Math.min(30, tile * 1.2);
    // A shallow tray: a pale lip below, then the darker well the yarn sits in.
    roundRect(ctx, left - pad, top - pad + 2, right - left + pad * 2, bottom - top + pad * 2, radius);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fill();
    roundRect(ctx, left - pad, top - pad, right - left + pad * 2, bottom - top + pad * 2, radius);
    ctx.fillStyle = '#dcd7f1';
    ctx.fill();

    const revealed = state.reveal !== null && state.reveal >= this.revealMs;
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = revealed ? 1 : UNDERLAY;
    ctx.drawImage(underlay, left, top, right - left, bottom - top);
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;

    const x0 = Math.max(0, Math.floor(-camera.panX / tile));
    const y0 = Math.max(0, Math.floor(-camera.panY / tile));
    const x1 = Math.min(w, Math.ceil((cssW - camera.panX) / tile));
    const y1 = Math.min(h, Math.ceil((cssH - camera.panY) / tile));

    if (state.hintId !== null) {
      const hinted = board.pieces[state.hintId];
      if (hinted) {
        const pulse = 0.5 + 0.5 * Math.sin(state.now / 190);
        ctx.save();
        ctx.translate(camera.panX, camera.panY);
        ctx.scale(tile, tile);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        tracePiece(ctx, hinted);
        // Violet outside, white inside: the ring reads against any picture colour.
        ctx.strokeStyle = `rgba(124, 108, 240, ${0.5 + pulse * 0.4})`;
        ctx.lineWidth = 1.42 + pulse * 0.24;
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.14;
        ctx.stroke();
        ctx.restore();
      }
    }

    if (x1 > x0 && y1 > y0) {
      sprites.setTile(tile * dpr);
      const xs: number[] = [];
      const ys: number[] = [];
      for (let x = x0; x <= x1; x++) xs.push(snap(camera.panX + x * tile));
      for (let y = y0; y <= y1; y++) ys.push(snap(camera.panY + y * tile));
      const anyBusy = state.flights.some((f) => f.kind === 'bounce');

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const at = y * w + x;
          const v = board.occ[at];
          if (v === 0 || (anyBusy && state.isBusy(v - 1))) continue;
          const sprite = sprites.get(board.color[at], this.links[at], this.heads[at] as Dir | -1);
          const px = xs[x - x0];
          const py = ys[y - y0];
          ctx.drawImage(sprite, px, py, xs[x - x0 + 1] - px, ys[y - y0 + 1] - py);
        }
      }
    }

    if (state.flights.length > 0) {
      ctx.save();
      ctx.translate(camera.panX, camera.panY);
      ctx.scale(tile, tile);
      for (const f of state.flights) {
        ctx.globalAlpha = f.kind === 'escape' ? Math.min(1, (1 - f.progress) / 0.22) : 1;
        drawStrand(ctx, f.piece, sprites.tones, f.offset);
      }
      ctx.globalAlpha = 1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const f of state.flights) {
        if (f.flash <= 0 || f.blockerId === null) continue;
        const blocker = board.pieces[f.blockerId];
        if (!blocker) continue;
        ctx.beginPath();
        tracePiece(ctx, blocker);
        ctx.strokeStyle = `rgba(255, 60, 96, ${0.62 * f.flash})`;
        ctx.lineWidth = OUTER;
        ctx.stroke();
      }
      ctx.restore();
    }

    effects.drawBoard(ctx, camera, state.now);

    if (state.reveal !== null && !revealed) {
      const cx = (w - 1) / 2;
      const cy = (h - 1) / 2;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const c = art.color[y * w + x];
          if (c < 0) continue;
          const t = (state.reveal - Math.hypot(x - cx, y - cy) * REVEAL_STEP) / REVEAL_POP;
          if (t <= 0) continue;
          ctx.fillStyle = art.palette[c];
          if (t >= 1) {
            // Settled cells sit on the snapped grid so no hairlines show between them.
            const sx = snap(camera.panX + x * tile);
            const sy = snap(camera.panY + y * tile);
            ctx.fillRect(sx, sy, snap(camera.panX + (x + 1) * tile) - sx, snap(camera.panY + (y + 1) * tile) - sy);
            continue;
          }
          const size = tile * easeOutBack(t);
          ctx.fillRect(
            camera.panX + (x + 0.5) * tile - size / 2,
            camera.panY + (y + 0.5) * tile - size / 2,
            size,
            size,
          );
        }
      }
    }

    ctx.restore();
    effects.drawScreen(ctx, state.now);
    ctx.globalAlpha = 1;
  }
}
