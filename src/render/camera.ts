import { clamp } from '../game/rng';

export interface Insets {
  top: number;
  bottom: number;
  side: number;
}

export interface View {
  tile: number;
  panX: number;
  panY: number;
}

const MIN_TILE = 6;
const MAX_TILE = 160;

export class Camera {
  tile = 32;
  panX = 0;
  panY = 0;
  viewW = 0;
  viewH = 0;
  private glide: { from: View; to: View; start: number; ms: number } | null = null;

  setViewport(w: number, h: number): void {
    this.viewW = w;
    this.viewH = h;
  }

  /** The view that shows the whole board inside the insets. */
  fitView(w: number, h: number, inset: Insets): View {
    const availW = Math.max(40, this.viewW - inset.side * 2);
    const availH = Math.max(40, this.viewH - inset.top - inset.bottom);
    const tile = clamp(Math.min(availW / w, availH / h), MIN_TILE, 72);
    return {
      tile,
      panX: (this.viewW - w * tile) / 2,
      panY: inset.top + (availH - h * tile) / 2,
    };
  }

  fit(w: number, h: number, inset: Insets): void {
    this.glide = null;
    Object.assign(this, this.fitView(w, h, inset));
  }

  glideTo(to: View, now: number, ms: number): void {
    this.glide = { from: { tile: this.tile, panX: this.panX, panY: this.panY }, to, start: now, ms };
  }

  /** Advances a running glide; returns true while the camera is still moving. */
  step(now: number): boolean {
    const g = this.glide;
    if (!g) return false;
    const t = clamp((now - g.start) / g.ms, 0, 1);
    const e = 1 - (1 - t) ** 3;
    this.tile = g.from.tile + (g.to.tile - g.from.tile) * e;
    this.panX = g.from.panX + (g.to.panX - g.from.panX) * e;
    this.panY = g.from.panY + (g.to.panY - g.from.panY) * e;
    if (t >= 1) this.glide = null;
    return true;
  }

  zoomAt(px: number, py: number, factor: number): void {
    this.glide = null;
    const next = clamp(this.tile * factor, MIN_TILE, MAX_TILE);
    const k = next / this.tile;
    this.panX = px - (px - this.panX) * k;
    this.panY = py - (py - this.panY) * k;
    this.tile = next;
  }

  panBy(dx: number, dy: number): void {
    this.glide = null;
    this.panX += dx;
    this.panY += dy;
  }

  constrain(w: number, h: number): void {
    const bw = w * this.tile;
    const bh = h * this.tile;
    const keep = Math.min(96, bw, bh);
    this.panX = clamp(this.panX, -(bw - keep), this.viewW - keep);
    this.panY = clamp(this.panY, -(bh - keep), this.viewH - keep);
  }

  cellAt(px: number, py: number): { x: number; y: number } {
    return {
      x: Math.floor((px - this.panX) / this.tile),
      y: Math.floor((py - this.panY) / this.tile),
    };
  }
}
