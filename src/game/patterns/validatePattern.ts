/**
 * Fairness validation.
 *
 * **Accountable owner: Obstacle Programmer** (`docs/RACI.md` row 15). A
 * generated sequence that cannot be survived is a defect here, even when the
 * parameters came from somebody else.
 *
 * `docs/GAME_DESIGN.md` §6 requires, before a pattern may spawn:
 *   - enough reaction distance/time;
 *   - a traversable safe region exists;
 *   - consecutive patterns do not combine into something impossible;
 *   - the obstacle does not spawn on top of the player.
 *
 * Insane runs the identical checks. Speed may make a tier brutal, never unfair
 * — which is why the reaction check scales with current speed instead of
 * assuming a fixed gap.
 */

import { gameplay } from '../config/gameplay';
import type { PatternResult } from './obstaclePatterns';

export type ValidationContext = {
  /** World x where the pattern's left edge would sit. */
  spawnX: number;
  /** Current world speed, world units per second. */
  speed: number;
  /** Current stack height in world units — a tall stack needs a bigger gap. */
  stackHeight: number;
  /** Player's current centre y, used for the reachability check. */
  playerY: number;
  /** Openings of the previous obstacle, if any. */
  previousOpenings?: { start: number; end: number }[] | undefined;
  /** World x of the previous obstacle's right edge, if any. */
  previousRightEdge?: number | undefined;
};

export type ValidationResult = {
  ok: boolean;
  /** Machine-readable reason, so tests can assert *why* something was rejected. */
  reason?:
    | 'noOpening'
    | 'openingTooSmall'
    | 'insufficientReactionDistance'
    | 'spawnsOnPlayer'
    | 'unreachableFromPrevious'
    | 'impossibleCombination';
};

const OK: ValidationResult = { ok: true };

/**
 * Seconds the player needs to see an obstacle, decide, and traverse the screen
 * vertically. Below this the pattern is a coin flip, not a challenge.
 */
export const MIN_REACTION_SECONDS = 0.75;

/** An opening must clear the stack by at least this much, or it is a trap. */
export const OPENING_CLEARANCE = gameplay.blockSize * 0.6;

function largestOpening(openings: { start: number; end: number }[]): number {
  return openings.reduce((max, o) => Math.max(max, o.end - o.start), 0);
}

export function validatePattern(
  pattern: PatternResult,
  context: ValidationContext,
): ValidationResult {
  const { spawnX, speed, stackHeight, playerY } = context;

  // 1. There must be somewhere to go.
  const openings = pattern.openings.filter((o) => o.end > o.start);
  if (openings.length === 0) return { ok: false, reason: 'noOpening' };

  // 2. The opening must actually fit the stack, with clearance.
  const required = stackHeight + OPENING_CLEARANCE;
  if (largestOpening(openings) < required) {
    return { ok: false, reason: 'openingTooSmall' };
  }

  // 3. Never spawn on top of the player. The pattern must appear ahead of the
  //    stack's right edge, not overlapping it.
  const playerRightEdge = gameplay.playerX + gameplay.blockSize / 2;
  if (spawnX <= playerRightEdge) {
    return { ok: false, reason: 'spawnsOnPlayer' };
  }

  // 4. Reaction distance scales with speed — this is what keeps Insane fair.
  const distance = spawnX - playerRightEdge;
  if (speed > 0 && distance / speed < MIN_REACTION_SECONDS) {
    return { ok: false, reason: 'insufficientReactionDistance' };
  }

  // 5. The opening must be reachable from where the player is now, given how
  //    long they have before the obstacle arrives.
  const secondsAvailable = speed > 0 ? distance / speed : Infinity;
  const reach = gameplay.maxVerticalSpeed * secondsAvailable;
  const reachable = openings.some((o) => {
    // Nearest point of the opening the stack centre could legally occupy.
    const lo = o.start + stackHeight / 2;
    const hi = o.end - stackHeight / 2;
    if (hi < lo) return false;
    const target = Math.min(Math.max(playerY, lo), hi);
    return Math.abs(target - playerY) <= reach;
  });
  if (!reachable) return { ok: false, reason: 'unreachableFromPrevious' };

  // 6. Consecutive patterns must not combine into something impossible: the
  //    player has to get from the previous opening to this one in the gap
  //    between them.
  const { previousOpenings, previousRightEdge } = context;
  if (previousOpenings && previousOpenings.length > 0 && previousRightEdge !== undefined) {
    const travelDistance = spawnX - previousRightEdge;
    if (travelDistance <= 0) {
      return { ok: false, reason: 'impossibleCombination' };
    }
    const travelSeconds = speed > 0 ? travelDistance / speed : Infinity;
    const travelReach = gameplay.maxVerticalSpeed * travelSeconds;

    const connects = previousOpenings.some((prev) => {
      const prevLo = prev.start + stackHeight / 2;
      const prevHi = prev.end - stackHeight / 2;
      if (prevHi < prevLo) return false;
      return openings.some((next) => {
        const nextLo = next.start + stackHeight / 2;
        const nextHi = next.end - stackHeight / 2;
        if (nextHi < nextLo) return false;
        // Shortest vertical distance between the two legal centre ranges.
        const separation =
          nextLo > prevHi ? nextLo - prevHi : prevLo > nextHi ? prevLo - nextHi : 0;
        return separation <= travelReach;
      });
    });

    if (!connects) return { ok: false, reason: 'impossibleCombination' };
  }

  return OK;
}
