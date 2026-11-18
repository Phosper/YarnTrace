export interface ClearRecord {
  moves: number;
  ms: number;
  at: number;
}

export type Progress = Record<string, ClearRecord>;

const KEY = 'yarntrace.progress.v1';

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Progress;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveClear(id: string, moves: number, ms: number): void {
  const progress = loadProgress();
  const previous = progress[id];
  const better = !previous || moves < previous.moves || (moves === previous.moves && ms < previous.ms);
  progress[id] = better ? { moves, ms, at: Date.now() } : previous;
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    /* storage unavailable */
  }
}
