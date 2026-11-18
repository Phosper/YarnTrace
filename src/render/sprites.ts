import type { Dir } from '../game/types';

function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  const target = amount < 0 ? 0 : 255;
  const p = Math.min(1, Math.abs(amount));
  const mix = (v: number) => Math.round(v + (target - v) * p);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

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

function drawArrow(ctx: CanvasRenderingContext2D, px: number, dir: Dir): void {
  ctx.save();
  ctx.translate(px / 2, px / 2);
  ctx.rotate((dir * Math.PI) / 2);
  const reach = px * 0.3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.96)';
  ctx.lineWidth = Math.max(1.4, px * 0.145);
  ctx.shadowColor = 'rgba(20,10,40,0.35)';
  ctx.shadowBlur = px * 0.07;
  ctx.beginPath();
  ctx.moveTo(0, -reach * 0.62);
  ctx.lineTo(0, reach * 0.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-reach * 0.6, -reach * 0.02);
  ctx.lineTo(0, -reach * 0.72);
  ctx.lineTo(reach * 0.6, -reach * 0.02);
  ctx.stroke();
  ctx.restore();
}

function renderTile(color: string, px: number, dir: Dir, head: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const pad = Math.max(1, px * 0.055);
  const size = px - pad * 2;
  const radius = size * 0.3;

  roundRect(ctx, pad, pad, size, size, radius);
  const grad = ctx.createLinearGradient(0, pad, 0, pad + size);
  grad.addColorStop(0, shade(color, 0.4));
  grad.addColorStop(0.42, color);
  grad.addColorStop(1, shade(color, -0.16));
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.lineWidth = Math.max(1, px * 0.05);
  ctx.strokeStyle = shade(color, -0.45);
  ctx.stroke();

  roundRect(ctx, pad + size * 0.16, pad + size * 0.1, size * 0.68, size * 0.24, size * 0.12);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fill();

  if (head) drawArrow(ctx, px, dir);
  return canvas;
}

export class SpriteCache {
  private map = new Map<string, HTMLCanvasElement>();
  private tilePx = 0;

  constructor(private palette: string[]) {}

  setTile(px: number): void {
    if (px !== this.tilePx) {
      this.tilePx = px;
      this.map.clear();
    }
  }

  get(colorIndex: number, dir: Dir, head: boolean): HTMLCanvasElement {
    const key = `${colorIndex}|${dir}|${head ? 1 : 0}`;
    let sprite = this.map.get(key);
    if (!sprite) {
      const color = this.palette[colorIndex] ?? '#9a92bd';
      sprite = renderTile(color, this.tilePx, dir, head);
      this.map.set(key, sprite);
    }
    return sprite;
  }
}
