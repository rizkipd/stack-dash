/**
 * Per-block collision.
 *
 * Owner: Collision/Physics Programmer (`docs/RACI.md` row 13).
 *
 * **Core invariant:** only blocks that geometrically collide with an obstacle
 * may be removed (`CLAUDE.md`, `docs/GAME_DESIGN.md` §5). This is the rule most
 * likely to be broken silently by a later optimisation.
 */

import { blockRect, stackBounds } from '../entities/PlayerStack';
import type { Collectible, Obstacle, PlayerStack, Rect } from '../types';

/** Standard AABB overlap. Touching edges do not count as a collision. */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/** Translates a pattern-local rect into world space. */
export function obstacleRects(obstacle: Obstacle): Rect[] {
  return obstacle.rects.map((rect) => ({ ...rect, x: rect.x + obstacle.x }));
}

export type CollisionResult = {
  /** Indices of blocks that collided, ascending. Never contains duplicates. */
  hitIndices: number[];
  /** World rects of the blocks that were hit — used to spawn shatter particles. */
  hitRects: Rect[];
};

/**
 * Tests every active block against every obstacle rect.
 *
 * The block array is **never mutated here**. Callers collect the result and
 * apply removal afterwards, which is what stops a block being removed twice
 * (QA Plan #7) and what keeps iteration safe.
 */
export function detectCollisions(
  stack: PlayerStack,
  obstacles: readonly Obstacle[],
): CollisionResult {
  const hitIndices: number[] = [];
  const hitRects: Rect[] = [];

  if (stack.blocks.length === 0 || obstacles.length === 0) {
    return { hitIndices, hitRects };
  }

  // Broad phase: skip obstacles nowhere near the stack.
  const bounds = stackBounds(stack);
  const nearby: Rect[] = [];
  for (const obstacle of obstacles) {
    for (const rect of obstacleRects(obstacle)) {
      if (rectsOverlap(bounds, rect)) nearby.push(rect);
    }
  }
  if (nearby.length === 0) return { hitIndices, hitRects };

  // Narrow phase: per block. A block is recorded at most once however many
  // rects it overlaps — two obstacles in one frame still cost one block.
  for (let i = 0; i < stack.blocks.length; i += 1) {
    if (!stack.blocks[i]!.active) continue;
    const rect = blockRect(stack, i);
    for (const other of nearby) {
      if (rectsOverlap(rect, other)) {
        hitIndices.push(i);
        hitRects.push(rect);
        break;
      }
    }
  }

  return { hitIndices, hitRects };
}

/**
 * Returns the collectibles the stack is touching this frame.
 * Already-collected items are skipped, so nothing can be collected twice
 * (QA Plan #12).
 */
export function detectCollections(
  stack: PlayerStack,
  collectibles: readonly Collectible[],
): Collectible[] {
  if (stack.blocks.length === 0) return [];

  const bounds = stackBounds(stack);
  const collected: Collectible[] = [];

  for (const item of collectibles) {
    if (item.collected) continue;
    const rect: Rect = {
      x: item.x - item.size / 2,
      y: item.y - item.size / 2,
      width: item.size,
      height: item.size,
    };
    if (rectsOverlap(bounds, rect)) collected.push(item);
  }

  return collected;
}
