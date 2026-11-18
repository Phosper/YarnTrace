export interface Settings {
  sound: boolean;
  haptics: boolean;
  reduceMotion: boolean;
}

const KEY = 'yarntrace.settings.v1';

function defaults(): Settings {
  const prefersLess =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  return { sound: true, haptics: true, reduceMotion: prefersLess };
}

export function loadSettings(): Settings {
  const base = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      sound: typeof parsed.sound === 'boolean' ? parsed.sound : base.sound,
      haptics: typeof parsed.haptics === 'boolean' ? parsed.haptics : base.haptics,
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
