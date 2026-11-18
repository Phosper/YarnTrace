import type { Dir } from '../game/types';
import { paintCell, tonesOf, type Tones } from './strand';

/**
 * Tiles are rasterised at a handful of fixed sizes and scaled to the camera,
 * so a pinch zoom only rebuilds the cache when it crosses into the next size.
 */
const SIZES = [8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384];

function bucket(px: number): number {
  for (const size of SIZES) if (size >= px) return size;
  return SIZES[SIZES.length - 1];
}

export class SpriteCache {
  readonly tones: Tones[];
  private map = new Map<number, HTMLCanvasElement>();
  private px = 0;

  constructor(palette: string[]) {
    this.tones = palette.map(tonesOf);
  }

  setTile(devicePx: number): void {
    const px = bucket(devicePx);
    if (px !== this.px) {
      this.px = px;
      this.map.clear();
    }
  }

  /** `links` is the 4-bit mask of directions the strand continues in; `head` is -1 for body cells. */
  get(colorIndex: number, links: number, head: Dir | -1): HTMLCanvasElement {
    const key = (colorIndex * 16 + links) * 5 + head + 1;
    let sprite = this.map.get(key);
    if (!sprite) {
      sprite = document.createElement('canvas');
      sprite.width = this.px;
      sprite.height = this.px;
      const ctx = sprite.getContext('2d');
      if (ctx) {
        ctx.scale(this.px, this.px);
        paintCell(ctx, this.tones[colorIndex] ?? tonesOf('#9a92bd'), links, head);
      }
      this.map.set(key, sprite);
    }
    return sprite;
  }
}
