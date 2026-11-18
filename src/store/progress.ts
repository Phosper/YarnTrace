export interface ClearRecord {
  stars: number;
  misses: number;
  ms: number;
  at: number;
}

export type Progress = Record<string, ClearRecord>;

const KEY = 'yarntrace.progress.v1';
const LAST_KEY = 'yarntrace.last.v1';
const COACH_KEY = 'yarntrace.coached.v1';

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<ClearRecord>>;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Progress = {};
    for (const [id, record] of Object.entries(parsed)) {
      if (!record || typeof record !== 'object') continue;
      // Records written before stars existed only prove the level was cleared.
      out[id] = {
        stars: typeof record.stars === 'number' ? record.stars : 1,
        misses: typeof record.misses === 'number' ? record.misses : 0,
        ms: typeof record.ms === 'number' ? record.ms : 0,
        at: typeof record.at === 'number' ? record.at : 0,
      };
    }
    return out;
  } catch {
    return {};
  }
}

/** Keeps the best run per level; returns true when this run beat the stored one. */
export function saveClear(id: string, stars: number, misses: number, ms: number): boolean {
  const progress = loadProgress();
  const previous = progress[id];
  const better =
    !previous ||
    stars > previous.stars ||
    (stars === previous.stars && (misses < previous.misses || (misses === previous.misses && ms < previous.ms)));
  if (!better) return false;
  progress[id] = { stars, misses, ms, at: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    /* storage unavailable */
  }
  return Boolean(previous);
}

export function loadLastLevel(): number | null {
  try {
    const value = Number(localStorage.getItem(LAST_KEY));
    return Number.isInteger(value) && value >= 1 ? value : null;
  } catch {
    return null;
  }
}

export function saveLastLevel(index: number): void {
  try {
    localStorage.setItem(LAST_KEY, String(index));
  } catch {
    /* storage unavailable */
  }
}

export function wasCoached(): boolean {
  try {
    return localStorage.getItem(COACH_KEY) === '1';
  } catch {
    return true;
  }
}

export function markCoached(): void {
  try {
    localStorage.setItem(COACH_KEY, '1');
  } catch {
    /* storage unavailable */
  }
}
