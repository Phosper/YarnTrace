import { PICTURES, pictureArt } from '../art/pictures';
import { generateLevel, type GenOptions } from './generator';
import { hashSeed, mulberry32, randInt } from './rng';
import type { Art, Level } from './types';

export const LEVEL_COUNT = PICTURES.length;

/** Longest side of the picture grid: 12 cells at level 1 up to 32 at the end. */
export function levelSize(index: number): number {
  return Math.round(12 + ((index - 1) * 20) / (LEVEL_COUNT - 1));
}

export function difficultyFor(index: number): GenOptions {
  if (index <= 8) return { minLen: 3, maxLen: 5, holeRatio: 0 };
  if (index <= 20) return { minLen: 3, maxLen: 7, holeRatio: 0 };
  if (index <= 32) return { minLen: 4, maxLen: 8, holeRatio: 0 };
  return { minLen: 4, maxLen: 10, holeRatio: 0 };
}

export function levelName(index: number): string {
  return PICTURES[index - 1]?.name ?? `关卡 ${index}`;
}

export function levelArt(index: number): Art {
  return pictureArt(PICTURES[index - 1], levelSize(index));
}

export function loadLevel(index: number): Level {
  return generateLevel(levelArt(index), difficultyFor(index), {
    id: `l${index}`,
    name: levelName(index),
    seed: hashSeed(`yarntrace/level/${index}`),
    level: index,
  });
}

/** A fresh cut of a library picture: the seed picks the picture, its size and the split. */
export function randomLevel(seed: number): Level {
  const rng = mulberry32(seed);
  const picture = PICTURES[randInt(rng, PICTURES.length)];
  const size = 14 + randInt(rng, 17);
  const minLen = 3 + randInt(rng, 3);
  const maxLen = minLen + 2 + randInt(rng, 5);
  return generateLevel(
    pictureArt(picture, size),
    { minLen, maxLen, holeRatio: 0 },
    { id: `s${seed}`, name: picture.name, seed },
  );
}

export function levelFromArt(art: Art, seed: number, name: string): Level {
  const rng = mulberry32(seed);
  const minLen = 3 + randInt(rng, 4);
  const maxLen = minLen + 3 + randInt(rng, 4);
  return generateLevel(art, { minLen, maxLen, holeRatio: 0 }, { id: `u${seed}`, name, seed });
}
