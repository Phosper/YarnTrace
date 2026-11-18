export interface Settings {
  guides: boolean;
  reduceMotion: boolean;
}

const KEY = 'yarntrace.settings.v1';

function defaults(): Settings {
  const prefersLess =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  return { guides: true, reduceMotion: prefersLess };
}

export function loadSettings(): Settings {
  const base = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      guides: typeof parsed.guides === 'boolean' ? parsed.guides : base.guides,
      reduceMotion: typeof parsed.reduceMotion === 'boolean' ? parsed.reduceMotion : base.reduceMotion,
    };
  } catch {
    return base;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable */
  }
}
