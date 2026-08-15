/**
 * Render-state audit.
 *
 * Drives real runs, including real collisions, and checks every number that
 * reaches Skia. NaN or Infinity in a path coordinate does not throw in
 * JavaScript — it reaches the native canvas and can take the process down,
 * which is exactly the "app just closes on hit" failure mode.
 *
 *   npm run audit:render
 */

import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (p) => import(pathToFileURL(join(root, p)).href);

const { GameEngine } = await load('src/game/engine/GameEngine.ts');
const { gameplay } = await load('src/game/config/gameplay.ts');
const { buildRenderState, PARTICLE_STRIDE, BLOCK_STRIDE, OBSTACLE_STRIDE, COLLECTIBLE_STRIDE } =
  await load('src/game/render/renderState.ts');

const FRAME = 1 / 60;
const problems = [];

function check(label, arr, stride, ctx) {
  if (arr.length % stride !== 0) {
    problems.push(`${label}: length ${arr.length} not a multiple of stride ${stride} — ${ctx}`);
    return;
  }
  for (let i = 0; i < arr.length; i += 1) {
    const v = arr[i];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      problems.push(`${label}[${i}] = ${v} (field ${i % stride}) — ${ctx}`);
      return;
    }
  }
}

for (const difficulty of ['easy', 'medium', 'hard', 'insane']) {
  for (let seed = 0; seed < 40 && problems.length < 12; seed += 1) {
    const engine = new GameEngine({ difficulty, seed });
    engine.start();

    for (let i = 0; i < 60 * 60; i += 1) {
      // Weave hard so the stack actually collides and bursts fire.
      if (i % 20 === 0) {
        engine.setTargetY(gameplay.worldHeight * (0.15 + 0.7 * Math.abs(Math.sin(i / 37))));
      }
      engine.update(FRAME);

      const s = buildRenderState(engine, 0.47, 12, 0);
      const ctx = `${difficulty} seed=${seed} frame=${i} blocks=${engine.blockCount} particles=${
        s.particles.length / PARTICLE_STRIDE
      }`;
      check('blocks', s.blocks, BLOCK_STRIDE, ctx);
      check('obstacles', s.obstacles, OBSTACLE_STRIDE, ctx);
      check('collectibles', s.collectibles, COLLECTIBLE_STRIDE, ctx);
      check('particles', s.particles, PARTICLE_STRIDE, ctx);

      for (const k of ['scale', 'offsetX', 'offsetY', 'lean', 'elapsed', 'distance', 'trail', 'shake']) {
        if (!Number.isFinite(s[k])) problems.push(`${k} = ${s[k]} — ${ctx}`);
      }

      // A negative or zero drawn size becomes a degenerate path; Skia does not
      // always survive one.
      for (let p = 0; p < s.particles.length; p += PARTICLE_STRIDE) {
        if (s.particles[p + 2] < 0) {
          problems.push(`particle size ${s.particles[p + 2]} negative — ${ctx}`);
          break;
        }
      }

      if (problems.length >= 12) break;
      if (engine.blockCount === 0) break;
    }
  }
}

if (problems.length === 0) {
  console.log('PASS — every render-state value finite across all runs.');
} else {
  console.log(`FAIL — ${problems.length} problem(s):\n`);
  for (const p of problems) console.log('  ' + p);
  process.exitCode = 1;
}
