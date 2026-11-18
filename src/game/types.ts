export type Dir = 0 | 1 | 2 | 3;

export const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export interface Vec {
  x: number;
  y: number;
}

export interface Piece {
  id: number;
  cells: Vec[];
  dir: Dir;
  colors: number[];
}

export interface Level {
  id: string;
  name: string;
  w: number;
  h: number;
  palette: string[];
  pieces: Piece[];
  meta: { level?: number; seed: number };
}

export type CollisionMode = 'head-ray' | 'swept';

export interface Attempt {
  pieceId: number;
  escapes: boolean;
  travel: number;
  visualAdvance: number;
  need: number;
  blockerId: number | null;
}

export interface Art {
  w: number;
  h: number;
  palette: string[];
  color: Int16Array;
}
