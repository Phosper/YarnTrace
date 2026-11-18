import { describe, expect, it } from 'vitest';
import { artFromRawImage, type RawImage } from '../src/art/imageToLevel';

function blank(w: number, h: number, rgba: [number, number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = rgba[0];
    data[i * 4 + 1] = rgba[1];
    data[i * 4 + 2] = rgba[2];
    data[i * 4 + 3] = rgba[3];
  }
  return data;
}

function fill(
  data: Uint8ClampedArray,
  w: number,
  x0: number,
  y0: number,
  w0: number,
  h0: number,
  rgba: [number, number, number, number],
): void {
  for (let y = y0; y < y0 + h0; y++) {
    for (let x = x0; x < x0 + w0; x++) {
      const i = (y * w + x) * 4;
      data[i] = rgba[0];
      data[i + 1] = rgba[1];
      data[i + 2] = rgba[2];
      data[i + 3] = rgba[3];
    }
  }
}

function raw(w: number, h: number, data: Uint8ClampedArray): RawImage {
  return { width: w, height: h, data };
}

describe('artFromRawImage', () => {
  it('keeps a transparent-background sprite and crops to its bounds', () => {
    const data = blank(8, 8, [0, 0, 0, 0]);
    fill(data, 8, 2, 3, 4, 4, [220, 40, 60, 255]);
    const art = artFromRawImage(raw(8, 8, data), 40);
    expect(art.w).toBe(4);
    expect(art.h).toBe(4);
    expect(art.color.length).toBe(16);
    expect(Array.from(art.color).every((c) => c >= 0)).toBe(true);
    expect(art.palette.length).toBeLessThanOrEqual(12);
  });

  it('treats the corner colour as background when the image is opaque', () => {
    const data = blank(10, 10, [255, 255, 255, 255]);
    fill(data, 10, 3, 3, 4, 4, [40, 120, 220, 255]);
    const art = artFromRawImage(raw(10, 10, data), 40);
    expect(art.w).toBe(4);
    expect(art.h).toBe(4);
    expect(Array.from(art.color).every((c) => c >= 0)).toBe(true);
  });

  it('caps the palette at 12 colours', () => {
    const w = 24;
    const h = 24;
    const data = blank(w, h, [0, 0, 0, 255]);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        data[i] = (x * 11) % 256;
        data[i + 1] = (y * 7) % 256;
        data[i + 2] = ((x + y) * 5) % 256;
        data[i + 3] = 255;
      }
    }
    const art = artFromRawImage(raw(w, h, data), 40);
    expect(art.palette.length).toBeLessThanOrEqual(12);
    expect(Array.from(art.color).every((c) => c >= 0 && c < art.palette.length)).toBe(true);
  });

  it('drops specks smaller than the minimum component size', () => {
    const data = blank(12, 12, [0, 0, 0, 0]);
    fill(data, 12, 1, 1, 5, 5, [90, 200, 120, 255]);
    fill(data, 12, 9, 9, 1, 1, [90, 200, 120, 255]);
    const art = artFromRawImage(raw(12, 12, data), 40);
    expect(art.w).toBe(5);
    expect(art.h).toBe(5);
  });

  it('never exceeds the requested grid size', () => {
    const data = blank(40, 40, [0, 0, 0, 0]);
    fill(data, 40, 0, 0, 40, 40, [10, 200, 30, 255]);
    const art = artFromRawImage(raw(40, 40, data), 16);
    expect(art.w).toBeLessThanOrEqual(16);
    expect(art.h).toBeLessThanOrEqual(16);
  });
});
