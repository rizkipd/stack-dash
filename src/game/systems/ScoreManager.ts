/**
 * Scoring. The primary score is **distance survived**
 * (`docs/GAME_DESIGN.md` §9).
 * Owner: Gameplay Programmer (`docs/RACI.md` row 9).
 */

import { gameplay } from '../config/gameplay';

/** World units per displayed point, so the HUD number reads at a human pace. */
const UNITS_PER_POINT = 10;

export function distanceToScore(distance: number): number {
  return Math.floor(distance / UNITS_PER_POINT);
}

/** Metres of world travelled this frame. */
export function accumulateDistance(
  distance: number,
  speed: number,
  dt: number,
): number {
  return distance + speed * dt;
}

/**
 * Clamps a frame delta.
 *
 * Load-bearing, not a nicety. Returning from background hands the loop a delta
 * of many seconds; without this the world advances far enough in one step to
 * teleport the stack straight through a wall (QA Plan #15). Also guards against
 * negative or non-finite deltas from a misbehaving clock.
 */
export function clampDelta(dt: number): number {
  if (!Number.isFinite(dt) || dt <= 0) return 0;
  return Math.min(dt, gameplay.maxFrameDelta);
}
