import './style.css';
import { artFromFile } from './art/imageToLevel';
import { Sfx, buzz } from './audio/sfx';
import { artOfLevel } from './game/generator';
import { LEVEL_COUNT, levelFromArt, loadLevel, randomLevel } from './game/registry';
import { stepsToExit } from './game/rules';
import { starsFor } from './game/score';
import { Session, escapeTimeAt, type Flight } from './game/session';
import { DIRS, type Level, type Piece } from './game/types';
import { BoardRenderer } from './render/boardRenderer';
import { Camera } from './render/camera';
import { Effects } from './render/effects';
import {
  loadLastLevel,
  loadProgress,
  markCoached,
  saveClear,
  saveLastLevel,
  wasCoached,
  type Progress,
} from './store/progress';
import { loadSettings, saveSettings } from './store/settings';
import { createHud } from './ui/hud';
import { Overlays } from './ui/overlays';
import { shareResult } from './ui/share';

const INSETS = { top: 136, bottom: 112, side: 30 };
const CONFETTI = ['#ff5c78', '#ffbf2f', '#62c84a', '#3f8ff0', '#9d74f2', '#ff9cc2', '#72d2f6'];

const canvas = document.getElementById('board') as HTMLCanvasElement;
const overlayRoot = document.getElementById('overlay') as HTMLElement;

const camera = new Camera();
const renderer = new BoardRenderer(canvas);
const effects = new Effects();
const overlays = new Overlays(overlayRoot);
const sfx = new Sfx();

let settings = loadSettings();
let progress: Progress = loadProgress();
sfx.enabled = settings.sound;

let level: Level | null = null;
let session: Session | null = null;
let levelIndex: number | null = 1;
let hintId: number | null = null;
let needsRender = true;
let shake = { start: 0, ms: 0, power: 0 };
/** After the last strand leaves: wait for it to fly off, pop the picture back in, then show the card. */
let celebration: { stage: 'wait' | 'reveal' | 'done'; at: number } | null = null;
/** 0 = no tutorial, 1 = waiting for the first tap, 2 = a few more guided moves. */
let coachStage = 0;
let bounceTipShown = false;

const hud = createHud({
  onRestart: () => {
    sfx.tick();
    restart();
  },
  onSettings: () => {
    sfx.tick();
    showSettings();
  },
  onLevels: () => {
    sfx.tick();
    showLevels();
  },
  onHint: () => showHint(),
  onFit: () => {
    if (!level) return;
    sfx.tick();
    camera.glideTo(camera.fitView(level.w, level.h, INSETS), performance.now(), 320);
  },
});

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.resize(w, h);
  camera.setViewport(w, h);
  needsRender = true;
}

function titleOf(next: Level, index: number | null): string {
  if (index !== null) return `第 ${index} 关 · ${next.name}`;
  return next.id.startsWith('s') ? `随机 · ${next.name}` : next.name;
}

function startLevel(next: Level, index: number | null): void {
  level = next;
  levelIndex = index;
  session = new Session(next, 'head-ray', performance.now());
  session.onImpact = onImpact;
  renderer.setLevel(next);
  effects.clear();
  hintId = null;
  celebration = null;
  overlays.hide();
  camera.fit(next.w, next.h, INSETS);
  hud.setTitle(titleOf(next, index));
  hud.setProgress(0, session.totalPieces);
  hud.setCombo(0);
  if (index !== null) saveLastLevel(index);

  coachStage = index === 1 && !wasCoached() ? 1 : 0;
  if (coachStage === 1) {
    hud.coach('点一条毛线，它会顺着箭头溜出去');
    hintId = session.hint()?.id ?? null;
  } else {
    hud.coach(null);
  }
  needsRender = true;
}

function restart(): void {
  if (level) startLevel(level, levelIndex);
}

/** Rings where the yarn used to lie, timed to the tail passing, and sparkles where the head exits. */
function spawnEscapeFx(piece: Piece, flight: Flight, now: number): void {
  if (!level) return;
  const n = piece.cells.length;
  piece.cells.forEach((cell, i) => {
    effects.puff(cell.x, cell.y, level?.palette[piece.colors[i]] ?? '#ffffff', now + escapeTimeAt(flight, n - 1 - i));
  });
  const head = piece.cells[0];
  const [dx, dy] = DIRS[piece.dir];
  const exit = stepsToExit(head.x, head.y, dx, dy, level.w, level.h) - 0.5;
  const colors = [...new Set(piece.colors)].map((c) => level?.palette[c] ?? '#ffffff');
  colors.push('#ffffff');
  effects.burst(
    head.x + 0.5 + dx * exit,
    head.y + 0.5 + dy * exit,
    dx,
    dy,
    colors,
    now + escapeTimeAt(flight, exit),
  );
}

function onImpact(flight: Flight): void {
  const now = performance.now();
  sfx.thud();
  buzz(settings.haptics, 22);
  const head = flight.piece.cells[0];
  const [dx, dy] = DIRS[flight.piece.dir];
  if (!settings.reduceMotion) {
    shake = { start: now, ms: 220, power: 5 };
    effects.impact(head.x + 0.5 + dx * (flight.reach + 0.3), head.y + 0.5 + dy * (flight.reach + 0.3), now);
  }
  if (!bounceTipShown) {
    bounceTipShown = true;
    hud.toast('被挡住了，先送走挡路的那条');
  }
}

function handleTap(px: number, py: number): void {
  sfx.unlock();
  if (!session || !level) return;
  const now = performance.now();
  const cell = camera.cellAt(px, py);
  const result = session.tap(cell.x, cell.y, now, settings.reduceMotion);
  if (result.kind === 'none') return;

  hintId = null;
  needsRender = true;
  hud.setCombo(session.combo);
  if (result.kind === 'bounce') return;

  sfx.pop(session.combo - 1);
  buzz(settings.haptics, 8);
  hud.setProgress(session.moves, session.totalPieces);
  const flight = session.flights[session.flights.length - 1];
  if (flight && flight.piece === result.piece) spawnEscapeFx(result.piece, flight, now);

  if (coachStage === 1) {
    coachStage = 2;
    hud.coach('就是这样！把整张图拆干净就过关');
  } else if (coachStage === 2 && session.moves >= 4) {
    coachStage = 0;
    hud.coach(null);
    markCoached();
  }

  if (result.kind === 'win') {
    celebration = { stage: 'wait', at: now };
    hud.coach(null);
    hud.setCombo(0);
  }
}

function advanceCelebration(now: number): void {
  if (!celebration || !session || !level) return;
  if (celebration.stage === 'wait' && session.flights.length === 0) {
    if (settings.reduceMotion) {
      celebration = { stage: 'reveal', at: now - renderer.revealMs };
    } else {
      celebration = { stage: 'reveal', at: now };
      camera.glideTo(camera.fitView(level.w, level.h, INSETS), now, 420);
      effects.confetti(now, camera.viewW, camera.viewH, CONFETTI);
    }
    sfx.win();
    buzz(settings.haptics, [20, 40, 30]);
  } else if (celebration.stage === 'reveal' && now - celebration.at >= renderer.revealMs + 420) {
    celebration.stage = 'done';
    finishLevel(now);
  }
}

function finishLevel(now: number): void {
  if (!session || !level) return;
  const played = level;
  const index = levelIndex;
  const ms = session.elapsedMs(now);
  const stars = starsFor(session.misses, session.totalPieces);
  const record = index !== null && saveClear(played.id, stars, session.misses, ms);
  progress = loadProgress();
  if (coachStage !== 0) markCoached();
  coachStage = 0;

  const title = titleOf(played, index);
  const url = new URL(location.href);
  url.search = index !== null ? `?l=${index}` : played.id.startsWith('s') ? `?s=${played.meta.seed}` : '';

  overlays.showWin({
    title,
    art: artOfLevel(played),
    stars,
    ms,
    misses: session.misses,
    combo: session.bestCombo,
    record,
    animate: !settings.reduceMotion,
    onStar: (i) => sfx.star(i),
    onAgain: () => startLevel(played, index),
    onNext:
      index !== null && index < LEVEL_COUNT ? () => startLevel(loadLevel(index + 1), index + 1) : null,
    onLevels: () => showLevels(),
    onShare: () => {
      void shareResult({
        title,
        text: `我在 YarnTrace 拆完了「${played.name}」，拿到 ${stars} 颗星！`,
        url: url.toString(),
        art: artOfLevel(played),
        stars,
      }).then((outcome) => {
        if (outcome === 'copied') hud.toast('链接已复制，去粘贴分享吧');
        if (outcome === 'failed') hud.toast('这台设备暂时没法分享');
      });
    },
  });
}

function showHint(): void {
  sfx.unlock();
  if (!session || !level) return;
  const piece = session.hint();
  if (!piece) {
    if (!session.won) hud.toast('稍等，毛线还在路上');
    return;
  }
  sfx.tick();
  hintId = piece.id;
  needsRender = true;

  // Bring the hinted head into view if the player has zoomed in elsewhere.
  const head = piece.cells[0];
  const hx = camera.panX + (head.x + 0.5) * camera.tile;
  const hy = camera.panY + (head.y + 0.5) * camera.tile;
  const off =
    hx < 40 || hx > camera.viewW - 40 || hy < INSETS.top || hy > camera.viewH - INSETS.bottom;
  if (off) {
    camera.glideTo(
      {
        tile: camera.tile,
        panX: camera.viewW / 2 - (head.x + 0.5) * camera.tile,
        panY: camera.viewH / 2 - (head.y + 0.5) * camera.tile,
      },
      performance.now(),
      320,
    );
  }
}

function showLevels(): void {
  overlays.showLevels({
    current: levelIndex,
    progress,
    onPick: (index) => startLevel(loadLevel(index), index),
    onRandom: () => startLevel(randomLevel((Math.random() * 0xffffffff) >>> 0), null),
    onUpload: async (file) => {
      hud.toast('正在解析图片…');
      try {
        const art = await artFromFile(file, 32);
        startLevel(levelFromArt(art, (Math.random() * 0xffffffff) >>> 0, '我的图片'), null);
      } catch {
        hud.toast('这张图没能解析');
      }
    },
  });
}

function showSettings(): void {
  overlays.showSettings(settings, (next) => {
    settings = next;
    sfx.enabled = next.sound;
    saveSettings(settings);
    if (next.sound) {
      sfx.unlock();
      sfx.tick();
    }
    needsRender = true;
  });
}

const pointers = new Map<number, { x: number; y: number }>();
let dragged = false;
let pinch: { dist: number } | null = null;

canvas.addEventListener('pointerdown', (event) => {
  canvas.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 1) dragged = false;
  if (pointers.size === 2) pinch = null;
});

canvas.addEventListener('pointermove', (event) => {
  const previous = pointers.get(event.pointerId);
  if (!previous || !level) return;
  const dx = event.clientX - previous.x;
  const dy = event.clientY - previous.y;

  if (pointers.size >= 2) {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    if (!pinch) {
      pinch = { dist };
    } else if (dist > 4) {
      camera.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, dist / pinch.dist);
      camera.constrain(level.w, level.h);
      pinch = { dist };
      needsRender = true;
    }
    dragged = true;
    return;
  }

  // Until the finger has clearly moved, keep the anchor so a shaky tap is not read as a drag.
  if (!dragged && Math.hypot(dx, dy) <= 6) return;
  dragged = true;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  camera.panBy(dx, dy);
  camera.constrain(level.w, level.h);
  needsRender = true;
});

canvas.addEventListener('pointerup', (event) => {
  const point = pointers.get(event.pointerId);
  pointers.delete(event.pointerId);
  if (pointers.size < 2) pinch = null;
  if (!point || dragged) return;
  handleTap(point.x, point.y);
});

canvas.addEventListener('pointercancel', (event) => {
  pointers.delete(event.pointerId);
  if (pointers.size < 2) pinch = null;
});

canvas.addEventListener(
  'wheel',
  (event) => {
    if (!level) return;
    event.preventDefault();
    camera.zoomAt(event.clientX, event.clientY, event.deltaY < 0 ? 1.12 : 1 / 1.12);
    camera.constrain(level.w, level.h);
    needsRender = true;
  },
  { passive: false },
);

window.addEventListener('keydown', (event) => {
  if (overlays.isOpen || event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key.toLowerCase();
  if (key === 'h') showHint();
  else if (key === 'r') restart();
  else if (key === 'f' && level) {
    camera.glideTo(camera.fitView(level.w, level.h, INSETS), performance.now(), 320);
  }
});

window.addEventListener('resize', () => {
  resize();
  if (level) camera.fit(level.w, level.h, INSETS);
});

function frame(now: number): void {
  if (session && level) {
    const flying = session.update(now);
    const gliding = camera.step(now);
    effects.prune(now);
    advanceCelebration(now);

    if (hintId !== null && !session.board.pieces[hintId]) hintId = null;
    const shaking = now < shake.start + shake.ms;
    const revealing =
      celebration !== null && celebration.stage === 'reveal' && now - celebration.at < renderer.revealMs;
    const animating = flying || gliding || effects.active || hintId !== null || shaking || revealing;

    if (animating || needsRender) {
      const power = shaking ? shake.power * (1 - (now - shake.start) / shake.ms) : 0;
      renderer.draw(session.board, camera, effects, {
        now,
        flights: session.flights,
        isBusy: (id) => (session as Session).isBusy(id),
        hintId,
        shakeX: Math.sin(now * 0.09) * power,
        shakeY: Math.cos(now * 0.11) * power,
        reveal: celebration && celebration.stage !== 'wait' ? now - celebration.at : null,
      });
      // One extra frame after motion stops paints the settled board.
      needsRender = animating;
    }
  }
  requestAnimationFrame(frame);
}

resize();

const params = new URLSearchParams(location.search);
const seedParam = params.get('s');
const levelParam = Number(params.get('l'));
if (seedParam) {
  startLevel(randomLevel(Number(seedParam) >>> 0), null);
} else {
  const wanted = Number.isInteger(levelParam) && levelParam >= 1 ? levelParam : (loadLastLevel() ?? 1);
  const index = Math.min(LEVEL_COUNT, wanted);
  startLevel(loadLevel(index), index);
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}

if (import.meta.env.DEV) {
  (window as unknown as { __yarn: unknown }).__yarn = {
    get session() {
      return session;
    },
    get level() {
      return level;
    },
    camera,
    renderer,
    /** Taps a strand by id (or the next movable one), as a real tap on its head would. */
    step(id?: number): boolean {
      const piece = id === undefined ? session?.hint() : session?.board.pieces[id];
      if (!piece) return false;
      const head = piece.cells[0];
      handleTap(camera.panX + (head.x + 0.5) * camera.tile, camera.panY + (head.y + 0.5) * camera.tile);
      return true;
    },
  };
}

requestAnimationFrame(frame);
