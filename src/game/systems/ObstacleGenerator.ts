/**
 * Controlled-random obstacle generation.
 *
 * Owner: Obstacle Programmer (`docs/RACI.md` rows 14-15).
 *
 * Pipeline (`docs/ARCHITECTURE.md` §8):
 *   Pattern Library → Random Selection → Parameter Variation →
 *   Fairness Validation → Spawn
 *
 * Never unconstrained random rectangles. If no candidate passes validation the
 * generator falls back to a guaranteed-passable gate rather than spawning
 * something unfair or skipping the spawn entirely.
 */

import { getDifficultyConfig } from '../config/difficulty';
import { gameplay } from '../config/gameplay';
import type { Rng } from '../engine/Rng';
import {
  ALL_PATTERNS,
  EARLY_PATTERNS,
  buildPattern,
  patternWidth,
  type PatternResult,
} from '../patterns/obstaclePatterns';
import { validatePattern, type ValidationContext } from '../patterns/validatePattern';
import type { Difficulty, Obstacle, ObstaclePatternType } from '../types';

let obstacleIdCounter = 0;

function nextObstacleId(): string {
  obstacleIdCounter += 1;
  return `obstacle-${obstacleIdCounter}`;
}

/** Test seam — keeps ids deterministic across runs in assertions. */
export function resetObstacleIds(): void {
  obstacleIdCounter = 0;
}

/** Complex patterns unlock once the player has settled in. */
const COMPLEXITY_UNLOCK_DISTANCE = 900;

export type GenerationContext = {
  difficulty: Difficulty;
  rng: Rng;
  speed: number;
  distance: number;
  stackHeight: number;
  playerY: number;
  spawnX: number;
  previousOpenings?: { start: number; end: number }[] | undefined;
  previousRightEdge?: number | undefined;
};

export type GenerationResult = {
  obstacle: Obstacle;
  openings: { start: number; end: number }[];
  rightEdge: number;
  /** True when every candidate failed and the safe fallback was used. */
  usedFallback: boolean;
};

/** How many times to re-roll before falling back. */
const MAX_ATTEMPTS = 12;

function availablePatterns(distance: number): readonly ObstaclePatternType[] {
  return distance < COMPLEXITY_UNLOCK_DISTANCE ? EARLY_PATTERNS : ALL_PATTERNS;
}

/**
 * A gate centred on the player, sized generously.
 *
 * Used only when every rolled candidate fails validation. It is always
 * passable by construction, so the generator can never stall or emit an
 * unfair pattern.
 */
function buildFallback(context: GenerationContext): PatternResult {
  const gap = Math.min(
    gameplay.worldHeight * 0.9,
    context.stackHeight + gameplay.blockSize * 3,
  );
  const half = gap / 2;
  const centre = Math.min(
    Math.max(context.playerY, half + 4),
    gameplay.worldHeight - half - 4,
  );
  const start = centre - half;
  const end = centre + half;
  return {
    rects: [
      { x: 0, y: 0, width: 90, height: Math.max(0, start) },
      {
        x: 0,
        y: end,
        width: 90,
        height: Math.max(0, gameplay.worldHeight - end),
      },
    ].filter((r) => r.height > 0),
    openings: [{ start, end }],
  };
}

export function generateObstacle(context: GenerationContext): GenerationResult {
  const config = getDifficultyConfig(context.difficulty);
  const pool = availablePatterns(context.distance);

  const validation: ValidationContext = {
    spawnX: context.spawnX,
    speed: context.speed,
    stackHeight: context.stackHeight,
    playerY: context.playerY,
    previousOpenings: context.previousOpenings,
    previousRightEdge: context.previousRightEdge,
  };

  let chosen: PatternResult | null = null;
  let chosenType: ObstaclePatternType = 'gate';

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const type = context.rng.pick(pool);

    // Parameter variation, bounded: the gap never shrinks below what the
    // current stack can physically fit through.
    const baseGap = gameplay.worldHeight * config.gapFraction;
    const jitter = context.rng.nextRange(0.92, 1.12);
    const gap = Math.max(
      context.stackHeight + gameplay.blockSize,
      baseGap * jitter,
    );

    const candidate = buildPattern(type, { gap, rng: context.rng });
    if (validatePattern(candidate, validation).ok) {
      chosen = candidate;
      chosenType = type;
      break;
    }
  }

  const usedFallback = chosen === null;
  const pattern = chosen ?? buildFallback(context);

  const obstacle: Obstacle = {
    id: nextObstacleId(),
    x: context.spawnX,
    rects: pattern.rects,
    patternType: usedFallback ? 'gate' : chosenType,
    passed: false,
  };

  return {
    obstacle,
    openings: pattern.openings,
    rightEdge: context.spawnX + patternWidth(pattern),
    usedFallback,
  };
}

/** Spacing to the next spawn, tightening slightly as the run progresses. */
export function nextSpawnGap(difficulty: Difficulty, distance: number): number {
  const config = getDifficultyConfig(difficulty);
  const tightening = Math.max(0.65, 1 - distance * 0.00006);
  return config.spawnSpacing * tightening;
}
