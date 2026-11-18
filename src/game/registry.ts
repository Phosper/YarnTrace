import { generateArt } from '../art/procedural';
import { generateLevel, type GenOptions } from './generator';
import { hashSeed, mulberry32, randInt } from './rng';
import type { Art, Level } from './types';

export const LEVEL_COUNT = 40;

export function difficultyFor(index: number): GenOptions & { size: number } {
  if (index <= 10) {
    return { size: 14 + ((index - 1) % 3), minLen: 3, maxLen: 6, holeRatio: 0 };
  }
  if (index <= 25) {
    return { size: 18 + ((index - 11) % 3) * 4, minLen: 5, maxLen: 9, holeRatio: 0.006 };
  }
  return { size: 30 + ((index - 26) % 5) * 3, minLen: 8, maxLen: 14, holeRatio: 0.018 };
}

export function loadLevel(index: number): Level {
  const seed = hashSeed(`yarntrace/level/${index}`);
  const tuning = difficultyFor(index);
  const art = generateArt(seed, { size: tuning.size });
  return generateLevel(art, tuning, {
    id: `l${index}`,
    name: `关卡 ${index}`,
    seed,
    level: index,
  });
}

export function randomLevel(seed: number): Level {
  const rng = mulberry32(seed);
  const size = 16 + randInt(rng, 22);
  const minLen = 3 + randInt(rng, 5);
  const maxLen = minLen + 3 + randInt(rng, 5);
  const art = generateArt(seed, { size });
  return generateLevel(
    art,
    { minLen, maxLen, holeRatio: 0.008 },
    { id: `s${seed}`, name: '随机图案', seed },
  );
}

export function levelFromArt(art: Art, seed: number, name: string): Level {
  const rng = mulberry32(seed);
  const minLen = 3 + randInt(rng, 4);
  const maxLen = minLen + 3 + randInt(rng, 4);
  return generateLevel(art, { minLen, maxLen, holeRatio: 0 }, { id: `u${seed}`, name, seed });
}
