/**
 * Nothing in the game can be lost, so stars only reward a clean run: they
 * count blocked taps against the number of strands on the board. The bar is
 * deliberately forgiving — a first-time player should not finish on one star.
 */
export function starsFor(misses: number, pieces: number): 1 | 2 | 3 {
  if (misses <= Math.max(2, Math.round(pieces * 0.1))) return 3;
  if (misses <= Math.max(5, Math.round(pieces * 0.25))) return 2;
  return 1;
}
