export interface HudCallbacks {
  onRestart: () => void;
  onSettings: () => void;
  onLevels: () => void;
  onHint: () => void;
  onGuides: () => void;
  onZoom: (value: number) => void;
}

export interface Hud {
  setTitle: (name: string) => void;
  setProgress: (left: number, total: number) => void;
  setGuides: (on: boolean) => void;
  setZoom: (value: number) => void;
  toast: (text: string) => void;
}

export function createHud(callbacks: HudCallbacks): Hud {
  const title = document.getElementById('level-name') as HTMLElement;
  const progress = document.getElementById('level-progress') as HTMLElement;
  const guides = document.getElementById('btn-guides') as HTMLButtonElement;
  const zoom = document.getElementById('zoom') as HTMLInputElement;

  const toast = document.createElement('div');
  toast.className = 'hint-toast';
  document.getElementById('app')?.appendChild(toast);
  let toastTimer = 0;

  (document.getElementById('btn-restart') as HTMLElement).addEventListener('click', callbacks.onRestart);
  (document.getElementById('btn-settings') as HTMLElement).addEventListener('click', callbacks.onSettings);
  (document.getElementById('btn-levels') as HTMLElement).addEventListener('click', callbacks.onLevels);
  (document.getElementById('btn-hint') as HTMLElement).addEventListener('click', callbacks.onHint);
  guides.addEventListener('click', callbacks.onGuides);

  zoom.addEventListener('input', () => callbacks.onZoom(Number(zoom.value)));
  zoom.addEventListener('change', () => callbacks.onZoom(Number(zoom.value)));

  return {
    setTitle(name) {
      title.textContent = name;
    },
    setProgress(left, total) {
      progress.textContent = `${left} / ${total} 团`;
    },
    setGuides(on) {
      guides.classList.toggle('active', on);
    },
    setZoom(value) {
      zoom.value = String(Math.min(3, Math.max(0.35, value)));
    },
    toast(text) {
      toast.textContent = text;
      toast.classList.add('show');
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => toast.classList.remove('show'), 1800);
    },
  };
}
