import './style.css';
import { artFromFile } from './art/imageToLevel';
import { clamp } from './game/rng';
import { LEVEL_COUNT, levelFromArt, loadLevel, randomLevel } from './game/registry';
import { attempt, movablePieces } from './game/rules';
import { Session } from './game/session';
import type { Level } from './game/types';
import { BoardRenderer } from './render/boardRenderer';
import { Camera } from './render/camera';
import { loadProgress, saveClear, type Progress } from './store/progress';
import { loadSettings, saveSettings } from './store/settings';
import { createHud } from './ui/hud';
import { Overlays } from './ui/overlays';

const INSETS = { top: 96, bottom: 118, side: 18 };

const canvas = document.getElementById('board') as HTMLCanvasElement;
const overlayRoot = document.getElementById('overlay') as HTMLElement;

const camera = new Camera();
const renderer = new BoardRenderer(canvas);
const overlays = new Overlays(overlayRoot);

let settings = loadSettings();
let progress: Progress = loadProgress();

let level: Level | null = null;
let session: Session | null = null;
let levelIndex: number | null = 1;
let baseTile = 40;
let hintId: number | null = null;
let needsRender = true;
let winShown = false;
let shownPieces = -1;

const hud = createHud({
  onRestart: () => restart(),
  onSettings: () => showSettings(),
  onLevels: () => showLevels(),
  onHint: () => showHint(),
  onGuides: () => {
    settings = { ...settings, guides: !settings.guides };
    saveSettings(settings);
    hud.setGuides(settings.guides);
    needsRender = true;
  },
  onZoom: (value) => {
    if (!level) return;
    camera.tile = clamp(baseTile * value, 6, 160);
    camera.constrain(level.w, level.h);
    needsRender = true;
  },
});

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.resize(w, h);
  camera.setViewport(w, h);
  needsRender = true;
}

function startLevel(next: Level, index: number | null): void {
  level = next;
  levelIndex = index;
  renderer.setPalette(next.palette);
  session = new Session(next, 'head-ray', performance.now());
  hintId = null;
  winShown = false;
  overlays.hide();
  camera.fit(next.w, next.h, INSETS);
  camera.constrain(next.w, next.h);
  baseTile = camera.tile;
  hud.setTitle(index ? `关卡 ${index}` : next.name);
  hud.setProgress(session.piecesLeft, session.totalPieces);
  shownPieces = session.piecesLeft;
  hud.setGuides(settings.guides);
  hud.setZoom(1);
  needsRender = true;
}

function restart(): void {
  if (level) startLevel(level, levelIndex);
}

function handleTap(px: number, py: number): void {
  if (!session || session.won) return;
  const cell = camera.cellAt(px, py);
  const result = session.tap(cell.x, cell.y, performance.now(), settings.reduceMotion);
  if (result === 'none') return;
  hintId = null;
  needsRender = true;
  if (result === 'win') {
    winShown = true;
    finishLevel();
  }
}

function finishLevel(): void {
  if (!session || !level) return;
  const elapsed = session.elapsedMs;
  saveClear(level.id, session.moves, elapsed);
  progress = loadProgress();
  const nextCallable =
    levelIndex !== null && levelIndex < LEVEL_COUNT
      ? () => startLevel(loadLevel(levelIndex as number + 1), (levelIndex as number) + 1)
      : null;
  overlays.showWin({
    name: level.name,
    moves: session.moves,
    ms: elapsed,
    onAgain: () => startLevel(level as Level, levelIndex),
    onNext: nextCallable,
    onLevels: () => showLevels(),
  });
}

function showHint(): void {
  if (!session) return;
  const piece = session.hint();
  if (!piece) {
    hud.toast('现在没有能飞出去的团');
    return;
  }
  hintId = piece.id;
  needsRender = true;
}

function showLevels(): void {
  overlays.showLevels({
    current: levelIndex,
    cleared: progress,
    onPick: (index) => startLevel(loadLevel(index), index),
    onRandom: () => startLevel(randomLevel((Math.random() * 0xffffffff) >>> 0), null),
    onUpload: async (file) => {
      hud.toast('正在解析图片…');
      try {
        const art = await artFromFile(file, 40);
        startLevel(levelFromArt(art, (Math.random() * 0xffffffff) >>> 0, '我的图案'), null);
      } catch {
        hud.toast('这张图没能解析');
      }
    },
  });
}

function showSettings(): void {
  overlays.showSettings(settings, (next) => {
    settings = next;
    saveSettings(settings);
    hud.setGuides(settings.guides);
    needsRender = true;
  });
}

const pointers = new Map<number, { x: number; y: number }>();
let dragged = false;
let pinch: { dist: number; tile: number } | null = null;

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
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    if (!pinch) {
      pinch = { dist, tile: camera.tile };
    } else if (dist > 4) {
      const factor = dist / pinch.dist;
      camera.zoomAt(cx, cy, factor);
      camera.constrain(level.w, level.h);
      pinch = { dist, tile: camera.tile };
      hud.setZoom(camera.tile / baseTile);
      needsRender = true;
    }
    dragged = true;
    return;
  }

  if (!dragged && Math.hypot(dx, dy) > 5) dragged = true;
  if (dragged) {
    camera.panBy(dx, dy);
    camera.constrain(level.w, level.h);
    needsRender = true;
  }
});

function releasePointer(event: PointerEvent): void {
  const point = pointers.get(event.pointerId);
  pointers.delete(event.pointerId);
  if (pointers.size < 2) pinch = null;
  if (!point || dragged) return;
  handleTap(point.x, point.y);
}

canvas.addEventListener('pointerup', releasePointer);
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
    hud.setZoom(camera.tile / baseTile);
    needsRender = true;
  },
  { passive: false },
);

window.addEventListener('resize', () => {
  resize();
  if (!level) return;
  camera.fit(level.w, level.h, INSETS);
  camera.constrain(level.w, level.h);
  baseTile = camera.tile;
  hud.setZoom(1);
});

function frame(now: number): void {
  if (session) {
    const hadMotion = session.motion !== null;
    const animating = session.update(now);
    if (hadMotion && !animating) needsRender = true;

    if (animating || needsRender) {
      renderer.draw(session.board, camera, {
        guides: settings.guides,
        reduceMotion: settings.reduceMotion,
        anim: session.motion,
        hintId,
      });
      needsRender = false;
    }

    if (session.piecesLeft !== shownPieces) {
      shownPieces = session.piecesLeft;
      hud.setProgress(shownPieces, session.totalPieces);
    }

    if (session.won && !winShown) {
      winShown = true;
      finishLevel();
    }
  }
  requestAnimationFrame(frame);
}

resize();

const seedParam = new URLSearchParams(location.search).get('s');
if (seedParam) {
  startLevel(randomLevel(Number(seedParam) >>> 0), null);
} else {
  startLevel(loadLevel(1), 1);
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
    attempt,
    movablePieces,
  };
}

requestAnimationFrame(frame);
