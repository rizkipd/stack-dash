import {
  detectCollections,
  detectCollisions,
  rectsOverlap,
} from '../src/game/systems/CollisionSystem';
import {
  blockRect,
  clampStackY,
  addBlock,
  removeBlocks,
  stackHeight,
} from '../src/game/entities/PlayerStack';
import { gameplay } from '../src/game/config/gameplay';
import type { Collectible, Obstacle, PlayerStack } from '../src/game/types';

function makeStack(count: number, y = gameplay.worldHeight / 2): PlayerStack {
  return {
    x: gameplay.playerX,
    y,
    blockSize: gameplay.blockSize,
    blocks: Array.from({ length: count }, (_, i) => ({
      id: `b${i}`,
      localIndex: i,
      active: true,
    })),
    verticalVelocity: 0,
  };
}

/** A wall covering everything below `fromY`. */
function wallBelow(x: number, fromY: number): Obstacle {
  return {
    id: 'o',
    x,
    rects: [{ x: 0, y: fromY, width: 90, height: gameplay.worldHeight }],
    patternType: 'bottomWall',
    passed: false,
  };
}

describe('rectsOverlap', () => {
  it('detects overlap', () => {
    expect(
      rectsOverlap(
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 5, y: 5, width: 10, height: 10 },
      ),
    ).toBe(true);
  });

  it('treats touching edges as no collision', () => {
    // A block grazing a wall edge should survive; strict inequality gives the
    // player the benefit of the doubt at exactly the boundary.
    expect(
      rectsOverlap(
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 10, y: 0, width: 10, height: 10 },
      ),
    ).toBe(false);
  });

  it('rejects separated rects', () => {
    expect(
      rectsOverlap(
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 40, y: 0, width: 10, height: 10 },
      ),
    ).toBe(false);
  });
});

describe('per-block collision', () => {
  it('removes nothing when the stack is clear', () => {
    const stack = makeStack(6);
    const far = wallBelow(gameplay.playerX + 800, 0);
    expect(detectCollisions(stack, [far]).hitIndices).toEqual([]);
  });

  // QA Plan #5, #6, #8 — the core invariant.
  it('hits only the blocks that actually overlap the wall', () => {
    const stack = makeStack(6);
    // Wall covers everything from the middle of the stack downward.
    const cut = stack.y;
    const obstacle = wallBelow(gameplay.playerX - 45, cut);

    const { hitIndices } = detectCollisions(stack, [obstacle]);

    expect(hitIndices.length).toBeGreaterThan(0);
    expect(hitIndices.length).toBeLessThan(stack.blocks.length);
    // Every reported index must genuinely overlap.
    for (const i of hitIndices) {
      const rect = blockRect(stack, i);
      expect(rect.y + rect.height).toBeGreaterThan(cut);
    }
    // Every unreported block must genuinely not overlap.
    const hit = new Set(hitIndices);
    for (let i = 0; i < stack.blocks.length; i += 1) {
      if (hit.has(i)) continue;
      expect(blockRect(stack, i).y + blockRect(stack, i).height).toBeLessThanOrEqual(cut);
    }
  });

  it('never reports the same block twice across overlapping obstacles', () => {
    const stack = makeStack(5);
    const a = wallBelow(gameplay.playerX - 45, 0);
    const b = wallBelow(gameplay.playerX - 40, 0);
    const { hitIndices } = detectCollisions(stack, [a, b]);
    expect(new Set(hitIndices).size).toBe(hitIndices.length);
  });

  it('returns nothing for an empty stack', () => {
    const stack = makeStack(0);
    expect(detectCollisions(stack, [wallBelow(gameplay.playerX, 0)]).hitIndices).toEqual([]);
  });

  it('does not mutate the stack', () => {
    const stack = makeStack(4);
    const before = JSON.stringify(stack);
    detectCollisions(stack, [wallBelow(gameplay.playerX - 45, 0)]);
    expect(JSON.stringify(stack)).toBe(before);
  });
});

describe('removeBlocks', () => {
  it('removes exactly the requested blocks', () => {
    const stack = makeStack(6);
    const next = removeBlocks(stack, [0, 1]);
    expect(next.blocks).toHaveLength(4);
  });

  it('re-indexes survivors contiguously', () => {
    const stack = makeStack(5);
    const next = removeBlocks(stack, [1, 3]);
    expect(next.blocks.map((b) => b.localIndex)).toEqual([0, 1, 2]);
  });

  it('preserves survivor identity', () => {
    const stack = makeStack(4);
    const next = removeBlocks(stack, [0]);
    expect(next.blocks.map((b) => b.id)).toEqual(['b1', 'b2', 'b3']);
  });

  it('keeps survivors roughly where they were on screen', () => {
    const stack = makeStack(6);
    // Blocks 0 and 1 are the bottom two.
    const survivorCentreBefore =
      (blockRect(stack, 2).y + blockRect(stack, 5).y + stack.blockSize) / 2;
    const next = removeBlocks(stack, [0, 1]);
    const survivorCentreAfter =
      (blockRect(next, 0).y + blockRect(next, 3).y + next.blockSize) / 2;
    expect(Math.abs(survivorCentreAfter - survivorCentreBefore)).toBeLessThan(1);
  });

  it('returns the stack untouched for an empty index list', () => {
    const stack = makeStack(3);
    expect(removeBlocks(stack, [])).toBe(stack);
  });

  it('can empty the stack completely', () => {
    const stack = makeStack(2);
    expect(removeBlocks(stack, [0, 1]).blocks).toHaveLength(0);
  });
});

describe('bounds', () => {
  // QA Plan #3.
  it('never lets the stack leave the world', () => {
    const stack = makeStack(8);
    const half = stackHeight(stack) / 2;
    expect(clampStackY(stack, -9999)).toBeCloseTo(half);
    expect(clampStackY(stack, 9999)).toBeCloseTo(gameplay.worldHeight - half);
  });

  it('keeps a grown stack inside the world', () => {
    let stack = makeStack(4, gameplay.blockSize * 2);
    for (let i = 0; i < 6; i += 1) stack = addBlock(stack);
    expect(blockRect(stack, stack.blocks.length - 1).y).toBeGreaterThanOrEqual(-0.001);
  });
});

describe('collectible detection', () => {
  const item = (over: Partial<Collectible> = {}): Collectible => ({
    id: 'c1',
    x: gameplay.playerX,
    y: gameplay.worldHeight / 2,
    size: 40,
    collected: false,
    ...over,
  });

  it('detects an overlapping collectible', () => {
    expect(detectCollections(makeStack(4), [item()])).toHaveLength(1);
  });

  // QA Plan #12.
  it('ignores an already-collected item', () => {
    expect(detectCollections(makeStack(4), [item({ collected: true })])).toHaveLength(0);
  });

  it('ignores a distant item', () => {
    expect(detectCollections(makeStack(4), [item({ x: gameplay.playerX + 900 })])).toHaveLength(0);
  });

  it('collects nothing with an empty stack', () => {
    expect(detectCollections(makeStack(0), [item()])).toHaveLength(0);
  });
});
