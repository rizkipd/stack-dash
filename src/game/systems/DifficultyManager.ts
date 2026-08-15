/**
 * Difficulty progression within a run.
 * Owner: Gameplay Programmer (`docs/RACI.md` row 7), values owned by the
 * Game Designer (row 4).
 *
 * "During a run, difficulty should also gradually increase with distance"
 * (`docs/GAME_DESIGN.md` §8). The ramp is capped so the game stays inside the
 * speed the fairness validator models.
 */

import { getDifficultyConfig } from '../config/difficulty';
import { gameplay } from '../config/gameplay';
import type { Difficulty } from '../types';

/** Multiplier applied on top of the difficulty's base speed. */
export function speedRamp(distance: number): number {
  const ramp = 1 + distance * gameplay.speedRampPerMetre;
  return Math.min(ramp, gameplay.maxSpeedRamp);
}

export function currentSpeed(difficulty: Difficulty, distance: number): number {
  const { speedMultiplier } = getDifficultyConfig(difficulty);
  return gameplay.baseSpeed * speedMultiplier * speedRamp(distance);
}

/** Gap shrinks slightly with distance, floored so it never becomes a trap. */
export function currentGapFraction(
  difficulty: Difficulty,
  distance: number,
): number {
  const { gapFraction } = getDifficultyConfig(difficulty);
  const shrink = Math.max(0.78, 1 - distance * 0.00003);
  return gapFraction * shrink;
}
