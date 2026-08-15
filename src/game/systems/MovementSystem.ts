/**
 * Vertical movement and world scrolling.
 * Owner: Gameplay Programmer (`docs/RACI.md` rows 8, 12).
 *
 * The player controls Y only. Horizontal travel is simulated by moving the
 * world left, which keeps coordinates bounded (`docs/ARCHITECTURE.md` §4).
 */

import { gameplay } from '../config/gameplay';
import { clampStackY } from '../entities/PlayerStack';
import type { PlayerStack } from '../types';

/**
 * Eases the stack toward `targetY`.
 *
 * Exponential smoothing is used rather than a fixed lerp factor so the feel is
 * frame-rate independent: at 30 FPS the stack covers the same ground per second
 * as at 60, instead of moving half as fast.
 */
export function updateStackPosition(
  stack: PlayerStack,
  targetY: number,
  dt: number,
): PlayerStack {
  const clampedTarget = clampStackY(stack, targetY);
  const alpha = 1 - Math.exp(-gameplay.dragFollowStrength * dt);
  const delta = (clampedTarget - stack.y) * alpha;

  // Cap travel per frame so the stack cannot outrun the speed the fairness
  // validator assumes it has.
  const maxTravel = gameplay.maxVerticalSpeed * dt;
  const applied = Math.min(Math.max(delta, -maxTravel), maxTravel);

  const nextY = clampStackY(stack, stack.y + applied);
  return {
    ...stack,
    y: nextY,
    verticalVelocity: dt > 0 ? (nextY - stack.y) / dt : 0,
  };
}

/** Distance the world scrolls this frame. */
export function advanceDistance(speed: number, dt: number): number {
  return speed * dt;
}
