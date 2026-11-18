import type { Art } from '../game/types';

/**
 * Paints a picture at one canvas pixel per cell, centred in a square canvas.
 * CSS scales it up with `image-rendering: pixelated`, so it stays crisp at any size.
 */
export function paintArt(canvas: HTMLCanvasElement, art: Art): void {
  const side = Math.max(art.w, art.h);
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const ox = Math.floor((side - art.w) / 2);
  const oy = Math.floor((side - art.h) / 2);
  for (let y = 0; y < art.h; y++) {
    for (let x = 0; x < art.w; x++) {
      const c = art.color[y * art.w + x];
      if (c < 0) continue;
      ctx.fillStyle = art.palette[c];
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}
