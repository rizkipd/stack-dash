/**
 * Player stack geometry and block bookkeeping.
 *
 * Owner: Collision/Physics Programmer (`docs/RACI.md` row 13) for the
 * rectangles; Gameplay Programmer (row 8) for block add/remove.
 *
 * Coordinate model (`docs/ARCHITECTURE.md` §4): `stack.y` is the **centre** of
 * the stack. Y grows downward, matching screen space. `localIndex` 0 is the
 * bottom block.
 */

import { gameplay } from '../config/gameplay';
import type { Block, PlayerStack, Rect } from '../types';

let blockIdCounter = 0;

/** Ids come from a counter, never `Math.random`, so runs stay reproducible. */
export function createBlock(localIndex: number): Block {
  blockIdCounter += 1;
  return { id: `block-${blockIdCounter}`, localIndex, active: true };
}

export function stackHeight(stack: PlayerStack): number {
  return stack.blocks.length * stack.blockSize;
}

export function stackTop(stack: PlayerStack): number {
  return stack.y - stackHeight(stack) / 2;
}

export function stackBottom(stack: PlayerStack): number {
  return stack.y + stackHeight(stack) / 2;
}

/**
 * World rectangle for the block at `localIndex`.
 *
 * Index 0 is the bottom block, so it sits furthest down the screen.
 */
export function blockRect(stack: PlayerStack, localIndex: number): Rect {
  const size = stack.blockSize;
  const fromTop = stack.blocks.length - 1 - localIndex;
  return {
    x: stack.x - size / 2,
    y: stackTop(stack) + fromTop * size,
    width: size,
    height: size,
  };
}

export function stackRects(stack: PlayerStack): Rect[] {
  return stack.blocks.map((_, i) => blockRect(stack, i));
}

/** Bounding box of the whole stack — cheap broad-phase before per-block tests. */
export function stackBounds(stack: PlayerStack): Rect {
  return {
    x: stack.x - stack.blockSize / 2,
    y: stackTop(stack),
    width: stack.blockSize,
    height: stackHeight(stack),
  };
}

/**
 * Clamps the stack centre so no block leaves the playable area.
 * QA Plan test #3 — the stack must never exit its bounds.
 */
export function clampStackY(stack: PlayerStack, y: number): number {
  const half = stackHeight(stack) / 2;
  const min = half;
  const max = gameplay.worldHeight - half;
  // When the stack is taller than the world it can only be centred.
  if (min > max) return gameplay.worldHeight / 2;
  return Math.min(max, Math.max(min, y));
}

/** Re-indexes blocks 0..n-1 from the bottom, preserving order. */
function reindex(blocks: Block[]): Block[] {
  return blocks.map((block, i) => ({ ...block, localIndex: i }));
}

/**
 * Removes the blocks at `indices` and re-compacts the stack.
 *
 * Survivors keep their absolute screen position: the new centre is placed at
 * the centroid of the surviving blocks rather than left where it was. Without
 * this, removing blocks from one end visibly teleports the survivors — and can
 * shove a survivor into the wall that just killed its neighbours, killing it on
 * the next frame for a collision it never had.
 *
 * The count invariant is what matters and is preserved exactly: only the
 * supplied indices are removed (`docs/GAME_DESIGN.md` §5).
 */
export function removeBlocks(
  stack: PlayerStack,
  indices: readonly number[],
): PlayerStack {
  if (indices.length === 0) return stack;

  const doomed = new Set(indices);
  const survivorIndices = stack.blocks
    .map((_, i) => i)
    .filter((i) => !doomed.has(i));

  if (survivorIndices.length === 0) {
    return { ...stack, blocks: [] };
  }

  // Centroid of the survivors' current rectangles, so nothing appears to jump.
  const centres = survivorIndices.map((i) => {
    const rect = blockRect(stack, i);
    return rect.y + rect.height / 2;
  });
  const centroid = centres.reduce((sum, c) => sum + c, 0) / centres.length;

  const survivors = reindex(survivorIndices.map((i) => stack.blocks[i]!));
  const next: PlayerStack = { ...stack, blocks: survivors, y: centroid };
  return { ...next, y: clampStackY(next, centroid) };
}

/** Adds one block to the top of the stack (`+1` collectible, M5). */
export function addBlock(stack: PlayerStack): PlayerStack {
  const blocks = [...stack.blocks, createBlock(stack.blocks.length)];
  const grown: PlayerStack = { ...stack, blocks: reindex(blocks) };
  // Growing upward would otherwise push the top block through the ceiling.
  return { ...grown, y: clampStackY(grown, grown.y) };
}
