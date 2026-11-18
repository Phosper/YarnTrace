import { clamp } from '../game/rng';

export interface Insets {
  top: number;
  bottom: number;
  side: number;
}

export class Camera {
  tile = 32;
  panX = 0;
  panY = 0;
  viewW = 0;
  viewH = 0;

  setViewport(w: number, h: number): void {
    this.viewW = w;
    this.viewH = h;
  }

  fit(w: number, h: number, inset: Insets): void {
    const availW = Math.max(40, this.viewW - inset.side * 2);
    const availH = Math.max(40, this.viewH - inset.top - inset.bottom);
    this.tile = clamp(Math.min(availW / w, availH / h), 6, 72);
    this.panX = (this.viewW - w * this.tile) / 2;
    this.panY = inset.top + (availH - h * this.tile) / 2;
  }

  zoomAt(px: number, py: number, factor: number): void {
    const next = clamp(this.tile * factor, 6, 160);
    const k = next / this.tile;
    this.panX = px - (px - this.panX) * k;
    this.panY = py - (py - this.panY) * k;
    this.tile = next;
  }

  panBy(dx: number, dy: number): void {
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
