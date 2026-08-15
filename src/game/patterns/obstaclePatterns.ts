/**
 * Obstacle pattern library.
 *
 * Owner: Obstacle Programmer (`docs/RACI.md` row 14).
 *
 * `docs/ARCHITECTURE.md` §8 forbids unconstrained random rectangles. Every
 * obstacle comes from a template here, is varied within bounded parameters,
 * and is then checked by `validatePattern.ts` before it may spawn.
 *
 * Each builder returns rects in world space with `x` relative to the obstacle's
 * own origin, so the generator can place the whole pattern by setting
 * `obstacle.x`.
 */

import { gameplay } from '../config/gameplay';
import type { ObstaclePatternType, Rect } from '../types';
import type { Rng } from '../engine/Rng';

/** Horizontal thickness of a wall column. */
export const WALL_THICKNESS = 90;

export type PatternParams = {
  /** Vertical opening size in world units. */
  gap: number;
  rng: Rng;
};

export type PatternResult = {
  rects: Rect[];
  /**
   * Vertical spans the player can pass through, as [start, end] pairs.
   * The validator uses these; nothing else should recompute them.
   */
  openings: { start: number; end: number }[];
};

const H = gameplay.worldHeight;

function wall(x: number, y: number, height: number): Rect {
  return { x, y, width: WALL_THICKNESS, height };
}

/** Opening hugs the top; wall rises from the floor. */
function bottomWall({ gap, rng }: PatternParams): PatternResult {
  const openingHeight = gap;
  // Keep the opening fully on screen with a margin, so it is always reachable.
  const openingStart = rng.nextRange(0, Math.max(0, H - openingHeight) * 0.35);
  const openingEnd = openingStart + openingHeight;
  return {
    rects: [wall(0, openingEnd, H - openingEnd)],
    openings: [{ start: openingStart, end: openingEnd }],
  };
}

/** Opening hugs the bottom; wall hangs from the ceiling. */
function topWall({ gap, rng }: PatternParams): PatternResult {
  const openingHeight = gap;
  const openingEnd = rng.nextRange(
    H - Math.max(0, H - openingHeight) * 0.35,
    H,
  );
  const openingStart = openingEnd - openingHeight;
  return {
    rects: [wall(0, 0, openingStart)],
    openings: [{ start: openingStart, end: openingEnd }],
  };
}

/** A block floating in the middle; the player passes above or below it. */
function centerWall({ gap, rng }: PatternParams): PatternResult {
  const blockHeight = rng.nextRange(H * 0.18, H * 0.32);
  // Leave at least `gap` above and below so both routes stay passable.
  const minTop = gap;
  const maxTop = H - gap - blockHeight;
  if (maxTop <= minTop) {
    return bottomWall({ gap, rng });
  }
  const top = rng.nextRange(minTop, maxTop);
  return {
    rects: [wall(0, top, blockHeight)],
    openings: [
      { start: 0, end: top },
      { start: top + blockHeight, end: H },
    ],
  };
}

/** Walls from both ceiling and floor with a single opening between them. */
function gate({ gap, rng }: PatternParams): PatternResult {
  const openingStart = rng.nextRange(H * 0.08, H - gap - H * 0.08);
  const openingEnd = openingStart + gap;
  return {
    rects: [wall(0, 0, openingStart), wall(0, openingEnd, H - openingEnd)],
    openings: [{ start: openingStart, end: openingEnd }],
  };
}

/**
 * Two gates in sequence with offset openings — forces a committed move rather
 * than a single correction.
 */
function staggered({ gap, rng }: PatternParams): PatternResult {
  const spacing = WALL_THICKNESS + gameplay.blockSize * 3;
  const firstStart = rng.nextRange(H * 0.06, H * 0.45);
  const firstEnd = firstStart + gap;

  // Offset the second opening, but keep it within one stack-travel of the
  // first or the pair becomes unreadable at speed.
  const drift = rng.nextRange(gap * 0.4, gap * 0.9) * (rng.chance(0.5) ? 1 : -1);
  const secondStart = Math.min(
    Math.max(firstStart + drift, H * 0.04),
    H - gap - H * 0.04,
  );
  const secondEnd = secondStart + gap;

  return {
    rects: [
      wall(0, 0, firstStart),
      wall(0, firstEnd, H - firstEnd),
      wall(spacing, 0, secondStart),
      wall(spacing, secondEnd, H - secondEnd),
    ],
    // The traversable span is the intersection of both gates.
    openings: [
      {
        start: Math.max(firstStart, secondStart),
        end: Math.min(firstEnd, secondEnd),
      },
    ],
  };
}

/** Two thin walls close together sharing one opening — a thicker gate. */
function doubleWall({ gap, rng }: PatternParams): PatternResult {
  const spacing = WALL_THICKNESS + gameplay.blockSize;
  const openingStart = rng.nextRange(H * 0.1, H - gap - H * 0.1);
  const openingEnd = openingStart + gap;
  return {
    rects: [
      wall(0, 0, openingStart),
      wall(0, openingEnd, H - openingEnd),
      wall(spacing, 0, openingStart),
      wall(spacing, openingEnd, H - openingEnd),
    ],
    openings: [{ start: openingStart, end: openingEnd }],
  };
}

const BUILDERS: Record<
  ObstaclePatternType,
  (params: PatternParams) => PatternResult
> = {
  bottomWall,
  topWall,
  centerWall,
  gate,
  staggered,
  doubleWall,
};

/** Patterns unlocked as the run progresses, simplest first. */
export const EARLY_PATTERNS: readonly ObstaclePatternType[] = [
  'bottomWall',
  'topWall',
  'gate',
];

export const ALL_PATTERNS: readonly ObstaclePatternType[] = [
  'bottomWall',
  'topWall',
  'centerWall',
  'gate',
  'staggered',
  'doubleWall',
];

export function buildPattern(
  type: ObstaclePatternType,
  params: PatternParams,
): PatternResult {
  return BUILDERS[type](params);
}

/** Total horizontal extent, so the generator knows how much room a pattern needs. */
export function patternWidth(result: PatternResult): number {
  return result.rects.reduce(
    (max, rect) => Math.max(max, rect.x + rect.width),
    0,
  );
}
