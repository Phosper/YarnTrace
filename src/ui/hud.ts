import { ICON } from './icons';

export interface HudCallbacks {
  onRestart: () => void;
  onSettings: () => void;
  onLevels: () => void;
  onHint: () => void;
  onFit: () => void;
}

export interface Hud {
  setTitle: (name: string) => void;
  setProgress: (cleared: number, total: number) => void;
  setCombo: (streak: number) => void;
  toast: (text: string) => void;
  /** Shows the onboarding bubble, or hides it when given null. */
  coach: (text: string | null) => void;
}

const COMBO_FROM = 3;

export function createHud(callbacks: HudCallbacks): Hud {
  const el = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;
  const title = el('level-name');
  const progress = el('level-progress');
  const meter = el('meter-fill');
  const combo = el('combo');
  const coach = el('coach');
  const toast = el('toast');
  let toastTimer = 0;

  const wire = (id: string, icon: string, handler: () => void): void => {
    const button = el(id);
    button.insertAdjacentHTML('afterbegin', icon);
    button.addEventListener('click', handler);
  };
  wire('btn-levels', ICON.levels, callbacks.onLevels);
  wire('btn-settings', ICON.settings, callbacks.onSettings);
  wire('btn-restart', ICON.restart, callbacks.onRestart);
  wire('btn-hint', ICON.hint, callbacks.onHint);
  wire('btn-fit', ICON.fit, callbacks.onFit);

  return {
    setTitle(name) {
      title.textContent = name;
    },
    setProgress(cleared, total) {
      progress.textContent = `${cleared} / ${total}`;
      meter.style.width = `${total > 0 ? (cleared / total) * 100 : 0}%`;
    },
    setCombo(streak) {
      if (streak < COMBO_FROM) {
        combo.classList.remove('show');
        return;
      }
      combo.textContent = `连击 ×${streak}`;
      combo.classList.add('show');
      // Restart the pop animation on every new step of the streak.
      combo.classList.remove('pop');
      void combo.offsetWidth;
      combo.classList.add('pop');
    },
    toast(text) {
      toast.textContent = text;
      toast.classList.add('show');
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => toast.classList.remove('show'), 1900);
    },
    coach(text) {
      coach.textContent = text ?? '';
      coach.classList.toggle('hidden', text === null);
    },
  };
}
