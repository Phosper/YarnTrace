import type { Art } from '../game/types';

export interface ShareOptions {
  title: string;
  text: string;
  url: string;
  art: Art;
  stars: number;
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

const W = 720;
const H = 900;

function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const radius = i % 2 === 0 ? r : r * 0.46;
    ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  }
  ctx.closePath();
}

/** The picture, its stars and its name on a card, ready to hand to the share sheet. */
function drawCard(opts: ShareOptions): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#f8eeff');
  bg.addColorStop(1, '#dfe7fd');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
  ctx.beginPath();
  ctx.roundRect?.(60, 60, W - 120, 560, 44);
  if (!ctx.roundRect) ctx.rect(60, 60, W - 120, 560);
  ctx.fill();

  const { art } = opts;
  const scale = Math.max(1, Math.floor(460 / Math.max(art.w, art.h)));
  const ox = Math.round((W - art.w * scale) / 2);
  const oy = Math.round(340 - (art.h * scale) / 2);
  for (let y = 0; y < art.h; y++) {
    for (let x = 0; x < art.w; x++) {
      const c = art.color[y * art.w + x];
      if (c < 0) continue;
      ctx.fillStyle = art.palette[c];
      ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
    }
  }

  for (let i = 0; i < 3; i++) {
    starPath(ctx, W / 2 + (i - 1) * 92, 706 - (i === 1 ? 14 : 0), 38);
    ctx.fillStyle = i < opts.stars ? '#ffbf2f' : '#d9d5ee';
    ctx.fill();
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#3b3557';
  ctx.font = '700 46px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText(opts.title, W / 2, 808);
  ctx.fillStyle = '#8b84ad';
  ctx.font = '500 26px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText('YarnTrace · 剥图消消', W / 2, 856);
  return canvas;
}

export async function shareResult(opts: ShareOptions): Promise<ShareOutcome> {
  const payload: ShareData = { title: opts.title, text: opts.text, url: opts.url };
  try {
    if (navigator.share) {
      const blob = await new Promise<Blob | null>((resolve) => drawCard(opts).toBlob(resolve, 'image/png'));
      if (blob) {
        const file = new File([blob], 'yarntrace.png', { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ ...payload, files: [file] });
          return 'shared';
        }
      }
      await navigator.share(payload);
      return 'shared';
    }
    await navigator.clipboard.writeText(`${opts.text} ${opts.url}`);
    return 'copied';
  } catch (error) {
    return error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}
