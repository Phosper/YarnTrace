import type { Camera } from './camera';

type Kind = 'dot' | 'ring' | 'spark' | 'tile';

/** A particle in board space (cell units), moved analytically from its age. */
interface Mote {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  born: number;
  life: number;
  size: number;
  color: string;
}

/** A confetti flake in screen space (css px). */
interface Flake {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
  w: number;
  h: number;
  spin: number;
  phase: number;
  color: string;
}

const DRAG = 3.2;
const TAU = Math.PI * 2;

export class Effects {
  private motes: Mote[] = [];
  private flakes: Flake[] = [];

  get active(): boolean {
    return this.motes.length > 0 || this.flakes.length > 0;
  }

  clear(): void {
    this.motes = [];
    this.flakes = [];
  }

  /** A square flash on a cell the moment it is vacated. */
  puff(x: number, y: number, color: string, born: number): void {
    this.motes.push({
      kind: 'tile',
      x: x + 0.5,
      y: y + 0.5,
      vx: 0,
      vy: 0,
      gravity: 0,
      born,
      life: 300,
      size: 1,
      color,
    });
  }

  /** Sparkles thrown forward as a piece leaves the board. */
  burst(x: number, y: number, dx: number, dy: number, colors: readonly string[], born: number): void {
    for (let i = 0; i < 7; i++) {
      const spread = (Math.random() - 0.5) * 5;
      const speed = 3 + Math.random() * 6;
      this.motes.push({
        kind: i % 2 === 0 ? 'spark' : 'dot',
        x,
        y,
        vx: dx * speed + dy * spread,
        vy: dy * speed + dx * spread,
        gravity: 0,
        born: born + i * 8,
        life: 380 + Math.random() * 260,
        size: 0.16 + Math.random() * 0.2,
        color: colors[i % colors.length],
      });
    }
  }

  /** The knock when a piece runs into something. */
  impact(x: number, y: number, born: number): void {
    this.motes.push({ kind: 'ring', x, y, vx: 0, vy: 0, gravity: 0, born, life: 300, size: 0.8, color: '#ff5c78' });
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * TAU + Math.random() * 0.6;
      const speed = 2.5 + Math.random() * 3;
      this.motes.push({
        kind: 'spark',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 0,
        born,
        life: 300 + Math.random() * 160,
        size: 0.2 + Math.random() * 0.14,
        color: i % 2 === 0 ? '#ff5c78' : '#ffd23f',
      });
    }
  }

  confetti(born: number, w: number, h: number, colors: readonly string[]): void {
    const count = Math.round(Math.min(150, Math.max(70, w / 5)));
    for (let i = 0; i < count; i++) {
      const fromLeft = i % 2 === 0;
      const angle = (fromLeft ? -Math.PI / 3 : (-Math.PI * 2) / 3) + (Math.random() - 0.5) * 0.9;
      const speed = (0.55 + Math.random() * 0.75) * Math.max(520, Math.min(980, h));
      this.flakes.push({
        x: fromLeft ? -10 : w + 10,
        y: h * (0.5 + Math.random() * 0.25),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        born: born + Math.random() * 260,
        life: 2300 + Math.random() * 1300,
        w: 6 + Math.random() * 6,
        h: 9 + Math.random() * 7,
        spin: (Math.random() - 0.5) * 14,
        phase: Math.random() * TAU,
        color: colors[i % colors.length],
      });
    }
  }

  /** Drops finished particles. Call once per frame before drawing. */
  prune(now: number): void {
    if (this.motes.length) this.motes = this.motes.filter((m) => now < m.born + m.life);
    if (this.flakes.length) this.flakes = this.flakes.filter((f) => now < f.born + f.life);
  }

  drawBoard(ctx: CanvasRenderingContext2D, camera: Camera, now: number): void {
    const tile = camera.tile;
    for (const m of this.motes) {
      const age = now - m.born;
      if (age < 0) continue;
      const t = age / m.life;
      const s = age / 1000;
      const glide = (1 - Math.exp(-DRAG * s)) / DRAG;
      const px = camera.panX + (m.x + m.vx * glide) * tile;
      const py = camera.panY + (m.y + m.vy * glide + 0.5 * m.gravity * s * s) * tile;

      if (m.kind === 'tile') {
        const side = tile * m.size * (1 - t * 0.35);
        ctx.globalAlpha = 0.6 * (1 - t);
        ctx.fillStyle = m.color;
        ctx.fillRect(px - side / 2, py - side / 2, side, side);
        continue;
      }

      if (m.kind === 'ring') {
        const grow = 1 - (1 - t) ** 3;
        ctx.globalAlpha = 0.55 * (1 - t);
        ctx.strokeStyle = m.color;
        ctx.lineWidth = Math.max(1, tile * 0.09 * (1 - t * 0.6));
        ctx.beginPath();
        ctx.arc(px, py, tile * m.size * (0.45 + grow * 0.75), 0, TAU);
        ctx.stroke();
        continue;
      }

      const r = tile * m.size * (1 - t * t);
      ctx.globalAlpha = Math.min(1, (1 - t) * 1.6);
      ctx.fillStyle = m.color;
      ctx.beginPath();
      if (m.kind === 'spark') {
        const thin = r * 0.3;
        ctx.moveTo(px, py - r);
        ctx.quadraticCurveTo(px + thin, py - thin, px + r, py);
        ctx.quadraticCurveTo(px + thin, py + thin, px, py + r);
        ctx.quadraticCurveTo(px - thin, py + thin, px - r, py);
        ctx.quadraticCurveTo(px - thin, py - thin, px, py - r);
      } else {
        ctx.arc(px, py, r * 0.6, 0, TAU);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawScreen(ctx: CanvasRenderingContext2D, now: number): void {
    for (const f of this.flakes) {
      const age = now - f.born;
      if (age < 0) continue;
      const s = age / 1000;
      const glide = (1 - Math.exp(-1.5 * s)) / 1.5;
      const x = f.x + f.vx * glide + Math.sin(f.phase + s * 3) * 14;
      const y = f.y + f.vy * glide + 260 * s * s;
      const t = age / f.life;
      ctx.save();
      ctx.globalAlpha = t > 0.75 ? (1 - t) * 4 : 1;
      ctx.translate(x, y);
      ctx.rotate(f.phase + f.spin * s);
      ctx.scale(1, Math.cos(f.phase + s * 9));
      ctx.fillStyle = f.color;
      ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
      ctx.restore();
    }
  }
}
