/**
 * Offline preview harness.
 *
 * Renders the real gameplay scene to a PNG using CanvasKit in Node, so the
 * output can actually be looked at without a device or a browser.
 *
 * This exists because rendering was unverifiable. Two bugs shipped that
 * typechecked, linted and bundled cleanly while drawing the wrong thing: an
 * inverted backface cull that reduced every "3D cube" to one flat dark quad,
 * and a skyline keyed off the screen slot so buildings morphed as they
 * scrolled. Neither is catchable by a type system. Both are obvious in a
 * picture.
 *
 * It imports `drawScene` from the app, so what is rendered here is the same
 * code the game runs — not a reimplementation that can drift.
 *
 *   npm run preview                    # default frame
 *   npm run preview -- --t=4           # simulate 4 seconds in
 *   npm run preview -- --fx            # trigger a hit burst and a collect
 *   npm run preview -- --fx --age=0.3  # ...and age it 0.3s before drawing
 *
 * Output: .preview/scene.png (gitignored)
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// --- Args ---
const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : fallback;
};
const WIDTH = arg('w', 390);
const HEIGHT = arg('h', 844);
const SECONDS = arg('t', 6);
const DIFFICULTY = (process.argv.find((a) => a.startsWith('--d=')) ?? '--d=medium').split('=')[1];

/**
 * Spawn the destruction and collect effects before drawing.
 *
 * Particles exist for a fraction of a second immediately after a collision, so
 * an ordinary preview frame practically never contains one — which made the
 * effects the least verifiable thing in the renderer, and it showed. `--age`
 * picks the moment in the burst to freeze: 0 is the flash, ~0.15 is mid-flight
 * debris, ~0.5 is the fall-and-fade tail.
 */
const FX = process.argv.includes('--fx');
const FX_AGE = arg('age', 0.14);

// --- CanvasKit ---
const ckDir = join(dirname(require.resolve('canvaskit-wasm/package.json')), 'bin', 'full');
const CanvasKitInit = require(join(ckDir, 'canvaskit.js'));
const CK = await CanvasKitInit({ locateFile: (f) => join(ckDir, f) });

/**
 * The real React Native Skia API, built from this CanvasKit instance.
 *
 * `JsiSkApi` is exactly what RN Skia uses for its own web build, so the harness
 * runs the same wrapper the browser does rather than a hand-rolled shim that
 * could drift. Notably, CanvasKit's raw `Path` has no `moveTo`/`addRect` — RN
 * Skia's `JsiSkPath` supplies them.
 */
const { JsiSkApi } = await import(
  pathToFileURL(
    join(root, 'node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkia.js'),
  ).href
);
const Sk = JsiSkApi(CK);

const ENUMS = {
  strokeStyle: 1, // PaintStyle.Stroke
  blendPlus: 12, // BlendMode.Plus
  blurNormal: 0, // BlurStyle.Normal
  capRound: 1, // StrokeCap.Round
  joinRound: 1, // StrokeJoin.Round
  tileClamp: 0, // TileMode.Clamp
};

// --- Load the app's simulation + scene (run under tsx, which handles TS and
//     the `@/` path alias) ---
const { GameEngine } = await import(pathToFileURL(join(root, 'src/game/engine/GameEngine.ts')).href);
const { buildRenderState } = await import(
  pathToFileURL(join(root, 'src/game/render/renderState.ts')).href
);
const scene = await import(pathToFileURL(join(root, 'src/components/game/scene.ts')).href);
const { gameplay } = await import(pathToFileURL(join(root, 'src/game/config/gameplay.ts')).href);

// --- Drive a real run so the frame contains real obstacles and motion ---
const engine = new GameEngine({ difficulty: DIFFICULTY, seed: 20260815 });
engine.start();
const FRAME = 1 / 60;
for (let i = 0; i < Math.round(SECONDS / FRAME); i += 1) {
  // Weave so the stack is mid-move and the whip/lean are visible.
  if (i % 45 === 0) {
    engine.setTargetY(gameplay.worldHeight * (0.3 + 0.4 * Math.abs(Math.sin(i / 120))));
  }
  engine.update(FRAME);
}

// The unattended run above will usually lose its stack, and a preview with no
// blocks cannot show the thing most worth looking at. Restore a full stack and
// park it in a gap so the cubes are visible and unobstructed.
const { createBlock } = await import(
  pathToFileURL(join(root, 'src/game/entities/PlayerStack.ts')).href
);
if (engine.blockCount < 6) {
  engine.stack = {
    ...engine.stack,
    blocks: Array.from({ length: 8 }, (_, i) => createBlock(i)),
  };
}
// Park clear of any wall so the stack is not drawn behind masonry.
const clearY = (() => {
  const h = engine.stack.blocks.length * engine.stack.blockSize;
  for (const candidate of [0.5, 0.34, 0.66, 0.24, 0.76]) {
    const y = gameplay.worldHeight * candidate;
    const top = y - h / 2;
    const bottom = y + h / 2;
    const clash = engine.obstacles.some((o) =>
      o.rects.some((r) => {
        const rx = r.x + o.x;
        const overlapsX =
          rx < gameplay.playerX + gameplay.blockSize &&
          rx + r.width > gameplay.playerX - gameplay.blockSize;
        return overlapsX && r.y < bottom && r.y + r.height > top;
      }),
    );
    if (!clash) return y;
  }
  return gameplay.worldHeight * 0.5;
})();
engine.stack = { ...engine.stack, y: clearY, verticalVelocity: -900 };

// --- Effects ---
// Fired directly rather than by staging a collision, because a real collision
// also removes the blocks — and the frame worth looking at is the one where the
// debris is still next to the stack it came from.
if (FX) {
  const { burst, sparkle, updateParticles } = await import(
    pathToFileURL(join(root, 'src/game/engine/Particles.ts')).href
  );
  const { blockRect } = await import(
    pathToFileURL(join(root, 'src/game/entities/PlayerStack.ts')).href
  );
  const { createRng } = await import(
    pathToFileURL(join(root, 'src/game/engine/Rng.ts')).href
  );
  const fxRng = createRng(20260815);

  // Burst the top three blocks: a multi-block loss is the worst case for both
  // readability and pool pressure, so it is the case worth previewing.
  const n = engine.stack.blocks.length;
  for (let i = Math.max(0, n - 3); i < n; i += 1) {
    burst(engine.particles, blockRect(engine.stack, i), fxRng);
  }

  // A collect, placed just ahead of and below the stack so both effects are in
  // frame at once and can be compared at a glance — which is the property that
  // actually matters (a gain must never be mistakable for a loss).
  sparkle(
    engine.particles,
    gameplay.playerX + gameplay.blockSize * 1.8,
    engine.stack.y + gameplay.blockSize * 1.4,
    gameplay.blockSize * 0.8,
    fxRng,
  );

  for (let i = 0; i < Math.round(FX_AGE / FRAME); i += 1) {
    updateParticles(engine.particles, FRAME, 0);
  }

  // Matching shake impulse, so the frame shows the whole hit and not just its
  // debris.
  engine.shake = 0.55;
}

const scale = HEIGHT / gameplay.worldHeight;
const state = buildRenderState(
  engine,
  scale,
  WIDTH * 0.22 - gameplay.playerX * scale,
  0,
);

// --- Render ---
// Surface and canvas come from the RN Skia wrapper too: its objects wrap
// CanvasKit handles, so a raw CanvasKit canvas cannot accept a wrapped paint.
const surface = Sk.Surface.Make(WIDTH, HEIGHT);
const canvas = surface.getCanvas();

// The sky and city bloom are declarative <Canvas> children in the app; the
// harness paints the equivalent so the preview matches what ships.
const sky = Sk.Paint();
sky.setShader(
  Sk.Shader.MakeLinearGradient(
    Sk.Point(0, 0),
    Sk.Point(0, HEIGHT),
    scene.SKY_COLORS.map((c) => Sk.Color(c)),
    scene.SKY_STOPS,
    0, // TileMode.Clamp
  ),
);
canvas.drawRect(Sk.XYWHRect(0, 0, WIDTH, HEIGHT), sky);

const bloom = Sk.Paint();
bloom.setShader(
  Sk.Shader.MakeRadialGradient(
    Sk.Point(WIDTH * 0.55, HEIGHT * 0.715),
    WIDTH * 1.05,
    scene.BLOOM_COLORS.map((c) => Sk.Color(c)),
    scene.BLOOM_STOPS,
    0,
  ),
);
canvas.drawRect(Sk.XYWHRect(0, 0, WIDTH, HEIGHT), bloom);

scene.drawScene(Sk, canvas, state, WIDTH, HEIGHT, ENUMS);

const png = surface.makeImageSnapshot().encodeToBytes();
if (!png) throw new Error('encodeToBytes returned null — surface produced no image');
mkdirSync(join(root, '.preview'), { recursive: true });
const out = join(root, '.preview', 'scene.png');
writeFileSync(out, png);

console.log(
  `${out}  ${WIDTH}x${HEIGHT}  ${DIFFICULTY} @ ${SECONDS}s  ` +
    `blocks=${engine.blockCount} obstacles=${engine.obstacles.length} ` +
    `collectibles=${engine.collectibles.length} distance=${Math.round(engine.distance)}` +
    (FX
      ? `  fx=on age=${FX_AGE}s particles=${engine.particles.filter((p) => p.active).length}`
      : ''),
);
