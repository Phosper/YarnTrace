import type { Board } from '../game/rules';
import { DIRS, type Dir, type Piece } from '../game/types';
import type { Camera } from './camera';
import { SpriteCache } from './sprites';

export interface AnimView {
  piece: Piece;
  dir: Dir;
  kind: 'escape' | 'bounce';
  offset: number;
  progress: number;
  flash: number;
  blockerId: number | null;
}

export interface DrawOptions {
  guides: boolean;
  reduceMotion: boolean;
  anim: AnimView | null;
  hintId: number | null;
}

const BG = '#e8e6f7';

export class BoardRenderer {
  private ctx: CanvasRenderingContext2D;
  private sprites: SpriteCache | null = null;
  private dpr = 1;
  private cssW = 0;
  private cssH = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('canvas 2d unavailable');
    this.ctx = ctx;
  }

  setPalette(palette: string[]): void {
    this.sprites = new SpriteCache(palette);
  }

  resize(cssW: number, cssH: number): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.cssW = cssW;
    this.cssH = cssH;
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
  }

  draw(board: Board, camera: Camera, opts: DrawOptions): void {
    const ctx = this.ctx;
    const sprites = this.sprites;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, this.cssW, this.cssH);
    if (!sprites) return;

    const tile = camera.tile;
    if (tile < 2) return;
    sprites.setTile(Math.max(8, Math.round(tile * this.dpr)));

    const x0 = Math.max(0, Math.floor(-camera.panX / tile));
    const y0 = Math.max(0, Math.floor(-camera.panY / tile));
    const x1 = Math.min(board.w, Math.ceil((this.cssW - camera.panX) / tile));
    const y1 = Math.min(board.h, Math.ceil((this.cssH - camera.panY) / tile));

    const dot = Math.max(1, tile * 0.07);
    ctx.fillStyle = 'rgba(120, 108, 190, 0.2)';
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        ctx.fillRect(camera.panX + x * tile - dot / 2, camera.panY + y * tile - dot / 2, dot, dot);
      }
    }

    const anim = opts.anim;
    const animId = anim ? anim.piece.id : -1;

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const at = y * board.w + x;
        const v = board.occ[at];
        if (v === 0 || v - 1 === animId) continue;
        const piece = board.pieces[v - 1];
        if (!piece) continue;
        const sprite = sprites.get(board.color[at], piece.dir, board.head[at] === 1);
        ctx.drawImage(sprite, camera.panX + x * tile, camera.panY + y * tile, tile, tile);
      }
    }

    if (opts.guides) {
      ctx.strokeStyle = 'rgba(59, 53, 87, 0.3)';
      ctx.lineWidth = Math.max(1, Math.min(2, tile * 0.055));
      ctx.beginPath();
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const at = y * board.w + x;
          const v = board.occ[at];
          if (v === 0 || v - 1 === animId) continue;
          const px = camera.panX + x * tile;
          const py = camera.panY + y * tile;
          if (x === 0 || board.occ[at - 1] !== v) {
            ctx.moveTo(px, py);
            ctx.lineTo(px, py + tile);
          }
          if (x === board.w - 1 || board.occ[at + 1] !== v) {
            ctx.moveTo(px + tile, py);
            ctx.lineTo(px + tile, py + tile);
          }
          if (y === 0 || board.occ[at - board.w] !== v) {
            ctx.moveTo(px, py);
            ctx.lineTo(px + tile, py);
          }
          if (y === board.h - 1 || board.occ[at + board.w] !== v) {
            ctx.moveTo(px, py + tile);
            ctx.lineTo(px + tile, py + tile);
          }
        }
      }
      ctx.stroke();
    }

    if (opts.hintId !== null) {
      const hinted = board.pieces[opts.hintId];
      if (hinted) {
        const own = new Set(hinted.cells.map((c) => c.y * board.w + c.x));
        ctx.strokeStyle = 'rgba(124, 108, 240, 0.95)';
        ctx.lineWidth = Math.max(2, tile * 0.1);
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (const c of hinted.cells) {
          const at = c.y * board.w + c.x;
          const px = camera.panX + c.x * tile;
          const py = camera.panY + c.y * tile;
          if (c.x === 0 || !own.has(at - 1)) {
            ctx.moveTo(px, py);
            ctx.lineTo(px, py + tile);
          }
          if (c.x === board.w - 1 || !own.has(at + 1)) {
            ctx.moveTo(px + tile, py);
            ctx.lineTo(px + tile, py + tile);
          }
          if (c.y === 0 || !own.has(at - board.w)) {
            ctx.moveTo(px, py);
            ctx.lineTo(px + tile, py);
          }
          if (c.y === board.h - 1 || !own.has(at + board.w)) {
            ctx.moveTo(px, py + tile);
            ctx.lineTo(px + tile, py + tile);
          }
        }
        ctx.stroke();
        ctx.lineJoin = 'miter';
      }
    }

    if (!anim) return;

    const [dx, dy] = DIRS[anim.dir];
    const ox = dx * anim.offset * tile;
    const oy = dy * anim.offset * tile;
    const fade =
      anim.kind === 'escape'
        ? Math.max(0, 1 - Math.max(0, anim.progress - 0.62) / 0.38)
        : 1;

    const paint = (shiftX: number, shiftY: number, alpha: number): void => {
      ctx.globalAlpha = alpha;
      for (let i = 0; i < anim.piece.cells.length; i++) {
        const cell = anim.piece.cells[i];
        const sprite = sprites.get(anim.piece.colors[i], anim.piece.dir, i === 0);
        ctx.drawImage(
          sprite,
          camera.panX + cell.x * tile + shiftX,
          camera.panY + cell.y * tile + shiftY,
          tile,
          tile,
        );
      }
    };

    if (anim.kind === 'escape' && !opts.reduceMotion) paint(ox * 0.7, oy * 0.7, 0.16 * fade);

    ctx.save();
    ctx.shadowColor = 'rgba(28, 20, 58, 0.35)';
    ctx.shadowBlur = tile * 0.4;
    ctx.shadowOffsetY = tile * 0.14;
    paint(ox, oy, fade);
    ctx.restore();
    ctx.globalAlpha = 1;

    if (anim.flash > 0 && anim.blockerId !== null) {
      const blocker = board.pieces[anim.blockerId];
      if (blocker) {
        const inset = tile * 0.06;
        for (const cell of blocker.cells) {
          const bx = camera.panX + cell.x * tile;
          const by = camera.panY + cell.y * tile;
          ctx.globalAlpha = 0.38 * anim.flash;
          ctx.fillStyle = '#ff3b5c';
          ctx.fillRect(bx + inset, by + inset, tile - inset * 2, tile - inset * 2);
          ctx.globalAlpha = Math.min(1, anim.flash);
          ctx.strokeStyle = '#ff5c78';
          ctx.lineWidth = Math.max(2, tile * 0.1);
          ctx.strokeRect(bx + inset * 2, by + inset * 2, tile - inset * 4, tile - inset * 4);
        }
        ctx.globalAlpha = 1;
      }
    }
  }
}
