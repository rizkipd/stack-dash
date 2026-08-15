import { GameEngine } from '../src/game/engine/GameEngine';
import { gameplay } from '../src/game/config/gameplay';
import { DIFFICULTIES } from '../src/game/types';

/**
 * Composed-world fairness.
 *
 * `obstacle-generator.test.ts` validates each pattern in isolation, which is
 * precisely the blind spot that shipped a broken build: two individually-legal
 * obstacles overlapped into a solid barrier with no way past. Per-pattern
 * validation can never catch that — only scanning the assembled world can.
 *
 * The cause was spacing measured from an obstacle's left edge while patterns
 * are up to 396 world units wide, so once the distance ramp tightened spacing
 * below that, the next obstacle spawned inside the previous one.
 *
 * `npm run audit:fairness` runs the same scan far wider (800 runs × 150s).
 * This keeps a fast slice of it in CI.
 */

const FRAME = 1 / 60;
const SECONDS = 45;

/** Largest vertical free span at world `x`, across every active obstacle. */
function largestGapAt(engine: GameEngine, x: number): number {
  const spans: [number, number][] = [];
  for (const o of engine.obstacles) {
    for (const r of o.rects) {
      const rx = r.x + o.x;
      if (rx <= x && rx + r.width >= x) spans.push([r.y, r.y + r.height]);
    }
  }
  if (spans.length === 0) return gameplay.worldHeight;

  spans.sort((a, b) => a[0] - b[0]);
  let best = 0;
  let cursor = 0;
  for (const [s, e] of spans) {
    if (s > cursor) best = Math.max(best, s - cursor);
    cursor = Math.max(cursor, e);
  }
  return Math.max(best, gameplay.worldHeight - cursor);
}

describe('no impassable barrier can form', () => {
  it.each(DIFFICULTIES)('%s never blocks the corridor', (difficulty) => {
    for (let seed = 0; seed < 12; seed += 1) {
      const engine = new GameEngine({ difficulty, seed });
      engine.start();

      for (let i = 0; i < Math.round(SECONDS / FRAME); i += 1) {
        engine.update(FRAME);
        if (engine.blockCount === 0) break;

        const stackHeight = engine.blockCount * engine.stack.blockSize;
        // Sample finer than the thinnest wall, so no barrier slips between.
        for (
          let x = gameplay.playerX;
          x < gameplay.playerX + gameplay.spawnAheadDistance;
          x += 20
        ) {
          const gap = largestGapAt(engine, x);
          if (gap < stackHeight) {
            throw new Error(
              `Impassable column: ${difficulty} seed=${seed} ` +
                `distance=${Math.round(engine.distance)} worldX=${Math.round(x)} ` +
                `needed=${stackHeight} gap=${Math.round(gap)} ` +
                `patterns=${engine.obstacles.map((o) => o.patternType).join('+')}`,
            );
          }
        }
      }
    }
  });

  it('never spawns an obstacle overlapping the previous one', () => {
    for (const difficulty of DIFFICULTIES) {
      const engine = new GameEngine({ difficulty, seed: 4242 });
      engine.start();

      for (let i = 0; i < Math.round(60 / FRAME); i += 1) {
        engine.update(FRAME);

        // Obstacles are spawned left to right, so sorting by x gives spawn
        // order; each must clear the one before it.
        const spans = engine.obstacles
          .map((o) => {
            const left = Math.min(...o.rects.map((r) => r.x + o.x));
            const right = Math.max(...o.rects.map((r) => r.x + o.x + r.width));
            return { left, right };
          })
          .sort((a, b) => a.left - b.left);

        for (let k = 1; k < spans.length; k += 1) {
          expect(spans[k]!.left).toBeGreaterThanOrEqual(spans[k - 1]!.right);
        }
      }
    }
  });
});
