/**
 * Fairness audit.
 *
 * Drives real runs and scans every world column ahead of the player for one
 * where the union of obstacle rects leaves no gap the stack could fit through.
 *
 * The unit tests validate each pattern *in isolation*, which is exactly the
 * blind spot: a barrier can be formed by two individually-legal obstacles that
 * physically overlap. This scans the composed world instead.
 *
 *   npm run audit:fairness
 */

import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (p) => import(pathToFileURL(join(root, p)).href);

const { GameEngine } = await load('src/game/engine/GameEngine.ts');
const { gameplay } = await load('src/game/config/gameplay.ts');

const DIFFICULTIES = ['easy', 'medium', 'hard', 'insane'];
const SEEDS = 200;
const SECONDS = 150;
const FRAME = 1 / 60;

/** Largest vertical free span at world x, given every active obstacle. */
function largestGapAt(engine, x) {
  const spans = [];
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
  best = Math.max(best, gameplay.worldHeight - cursor);
  return best;
}

const failures = [];

for (const difficulty of DIFFICULTIES) {
  for (let seed = 0; seed < SEEDS; seed += 1) {
    const engine = new GameEngine({ difficulty, seed });
    engine.start();

    for (let i = 0; i < Math.round(SECONDS / FRAME); i += 1) {
      engine.update(FRAME);
      if (engine.blockCount === 0) break;

      const stackHeight = engine.blockCount * engine.stack.blockSize;

      // Sample the corridor ahead of the player at a resolution finer than the
      // thinnest wall, so no barrier can slip between samples.
      for (
        let x = gameplay.playerX;
        x < gameplay.playerX + gameplay.spawnAheadDistance;
        x += 15
      ) {
        const gap = largestGapAt(engine, x);
        if (gap < stackHeight) {
          failures.push({
            difficulty,
            seed,
            distance: Math.round(engine.distance),
            blocks: engine.blockCount,
            stackHeight,
            gap: Math.round(gap),
            worldX: Math.round(x),
            patterns: engine.obstacles.map((o) => o.patternType).join('+'),
          });
          i = Infinity;
          break;
        }
      }
    }
  }
}

const runs = DIFFICULTIES.length * SEEDS;
if (failures.length === 0) {
  console.log(`PASS — ${runs} runs, no impassable column found.`);
} else {
  console.log(`FAIL — ${failures.length}/${runs} runs hit an impassable column.\n`);
  const byDifficulty = {};
  for (const f of failures) byDifficulty[f.difficulty] = (byDifficulty[f.difficulty] ?? 0) + 1;
  console.log('by difficulty:', byDifficulty);
  console.log('\nfirst 12:');
  for (const f of failures.slice(0, 12)) {
    console.log(
      `  ${f.difficulty.padEnd(6)} seed=${String(f.seed).padStart(3)} ` +
        `dist=${String(f.distance).padStart(6)} blocks=${f.blocks} ` +
        `need=${f.stackHeight} gap=${String(f.gap).padStart(4)} ` +
        `patterns=${f.patterns}`,
    );
  }
  process.exitCode = 1;
}
