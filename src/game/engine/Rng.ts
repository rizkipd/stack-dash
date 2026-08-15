/**
 * Seeded, injectable pseudo-random number generator.
 *
 * Present from the first commit rather than retrofitted at M4, for two
 * reasons stated in `docs/ARCHITECTURE.md` §8:
 *
 *   1. QA can reproduce any generation failure from its seed.
 *   2. A future daily challenge becomes a seed choice, not a new system.
 *
 * `Math.random()` must never appear in `src/game/`.
 *
 * Algorithm is mulberry32: small, fast, and good enough for obstacle
 * selection. It is not cryptographically secure and must not be used as if
 * it were.
 */

export type Rng = {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max]. */
  nextInt(min: number, max: number): number;
  /** Uniform float in [min, max). */
  nextRange(min: number, max: number): number;
  /** True with probability `p`. */
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Current internal state — lets a run be resumed or a failure replayed. */
  getState(): number;
};

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    nextInt: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    nextRange: (min, max) => next() * (max - min) + min,
    chance: (p) => next() < p,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new Error('Rng.pick called with an empty array');
      }
      // Non-null assertion is safe: index is bounded by the length check above.
      return items[Math.floor(next() * items.length)]!;
    },
    getState: () => state,
  };
}

/** Seed for an ordinary run. Callers in tests should pass a fixed seed instead. */
export function createSeed(): number {
  return Date.now() >>> 0;
}
