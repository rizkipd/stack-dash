/**
 * Generates the app icon: a glowing cube on the game's own neon gradient.
 *
 * The design sheet's APP STORE ICON is only ~94px in the composite, so
 * upscaling it to 1024 would be a blurry mess. Drawing the icon instead keeps
 * it sharp at every size and guarantees it matches the cube the game actually
 * renders.
 *
 * The cube maths is duplicated from `src/components/game/scene.ts` rather than
 * imported: this is a one-off asset generator, and the runtime version lives
 * inside a Reanimated worklet closure. If the player cube's look changes
 * materially, re-run this.
 *
 *   node scripts/make-icon.mjs
 *
 * Outputs: assets/icon.png (1024), assets/android-icon-foreground.png (432
 * safe-zone cube on transparent), assets/favicon.png (48).
 */

import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ckDir = join(dirname(require.resolve('canvaskit-wasm/package.json')), 'bin', 'full');
const CK = await require(join(ckDir, 'canvaskit.js'))({ locateFile: (f) => join(ckDir, f) });

const VERTS = [
  [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
  [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
];
const FACES = [
  [0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7],
  [1, 5, 6, 2], [4, 5, 1, 0], [3, 2, 6, 7],
];
const EDGES = [
  [0, 1, 0, 4], [1, 2, 0, 3], [2, 3, 0, 5], [3, 0, 0, 2],
  [4, 5, 1, 4], [5, 6, 1, 3], [6, 7, 1, 5], [7, 4, 1, 2],
  [0, 4, 2, 4], [1, 5, 3, 4], [2, 6, 3, 5], [3, 7, 2, 5],
];
const CAMERA_Z = 9;
const LIGHT = [-0.42, -0.66, 0.62];

const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const SHADOW = hex('#1B4FBF');
const BODY = hex('#2B7FFF');
const HIGHLIGHT = hex('#8FCEFF');
const EDGE = [0.88, 0.98, 1];

const mix = (a, b, t) =>
  CK.Color4f(
    Math.min(1, a[0] + (b[0] - a[0]) * t),
    Math.min(1, a[1] + (b[1] - a[1]) * t),
    Math.min(1, a[2] + (b[2] - a[2]) * t),
    1,
  );

function drawCube(canvas, cx, cy, size, rotX, rotY) {
  const half = size / 2;
  const sx = Math.sin(rotX), cxr = Math.cos(rotX);
  const sy = Math.sin(rotY), cy2 = Math.cos(rotY);

  const vx = [], vy = [], vz = [];
  for (let i = 0; i < 8; i += 1) {
    const v = VERTS[i];
    const x1 = v[0] * cy2 + v[2] * sy;
    const z1 = -v[0] * sy + v[2] * cy2;
    const y2 = v[1] * cxr - z1 * sx;
    const z2 = v[1] * sx + z1 * cxr;
    const d = CAMERA_Z / (CAMERA_Z - z2);
    vx[i] = cx + x1 * half * d;
    vy[i] = cy + y2 * half * d;
    vz[i] = z2;
  }

  // Rotated basis vectors give every face normal without a matrix library.
  const bx = [cy2, 0, -sy * cxr];
  const by = [0, cxr, sx];
  const bz = [sy, -cy2 * sx, cy2 * cxr];
  const N = [
    [-bz[0], -bz[1], -bz[2]], [bz[0], bz[1], bz[2]],
    [-bx[0], -bx[1], -bx[2]], [bx[0], bx[1], bx[2]],
    [-by[0], -by[1], -by[2]], [by[0], by[1], by[2]],
  ];

  const paint = new CK.Paint();
  paint.setAntiAlias(true);

  // Emissive halo behind the cube.
  const glow = new CK.Paint();
  glow.setAntiAlias(true);
  glow.setBlendMode(CK.BlendMode.Plus);
  glow.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, size * 0.14, true));
  glow.setColor(CK.Color4f(0.17, 0.5, 1, 0.55));
  canvas.drawCircle(cx, cy, size * 0.62, glow);

  const visible = N.map((n) => n[2] > 0.0015);

  for (let f = 0; f < 6; f += 1) {
    if (!visible[f]) continue;
    const face = FACES[f];
    const lambert = Math.max(0, N[f][0] * LIGHT[0] + N[f][1] * LIGHT[1] + N[f][2] * LIGHT[2]);
    const rim = (1 - N[f][2]) ** 2;
    const shade = Math.max(0, Math.min(1, 0.12 + 0.42 * lambert + 0.11 * rim));
    const color =
      shade < 0.45
        ? mix(SHADOW, BODY, shade / 0.45)
        : shade < 0.8
          ? mix(BODY, HIGHLIGHT, (shade - 0.45) / 0.35)
          : mix(HIGHLIGHT, EDGE, ((shade - 0.8) / 0.2) * 0.3);

    const path = new CK.Path();
    path.moveTo(vx[face[0]], vy[face[0]]);
    for (let k = 1; k < 4; k += 1) path.lineTo(vx[face[k]], vy[face[k]]);
    path.close();
    paint.setColor(color);
    canvas.drawPath(path, paint);
  }

  // Neon filament along every visible edge.
  const wire = new CK.Path();
  for (const [a, b, fa, fb] of EDGES) {
    if (!visible[fa] && !visible[fb]) continue;
    wire.moveTo(vx[a], vy[a]);
    wire.lineTo(vx[b], vy[b]);
  }
  const stroke = new CK.Paint();
  stroke.setAntiAlias(true);
  stroke.setStyle(CK.PaintStyle.Stroke);
  stroke.setStrokeJoin(CK.StrokeJoin.Round);
  stroke.setStrokeCap(CK.StrokeCap.Round);
  stroke.setColor(CK.Color4f(0.88, 0.98, 1, 1));
  stroke.setStrokeWidth(size * 0.02);
  canvas.drawPath(wire, stroke);
}

function render(size, { background = true } = {}) {
  const surface = CK.MakeSurface(size, size);
  const canvas = surface.getCanvas();
  canvas.clear(CK.TRANSPARENT);

  if (background) {
    const bg = new CK.Paint();
    bg.setShader(
      CK.Shader.MakeLinearGradient(
        [0, 0],
        [0, size],
        [CK.Color4f(...hex('#141036'), 1), CK.Color4f(...hex('#4C1D95'), 1), CK.Color4f(...hex('#B3357F'), 1)],
        [0, 0.55, 1],
        CK.TileMode.Clamp,
      ),
    );
    canvas.drawRect(CK.XYWHRect(0, 0, size, size), bg);

    // Warm swoosh under the cube, echoing the sheet's icon.
    const swoosh = new CK.Paint();
    swoosh.setAntiAlias(true);
    swoosh.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, size * 0.06, true));
    swoosh.setColor(CK.Color4f(...hex('#F97316'), 0.85));
    const p = new CK.Path();
    p.moveTo(-size * 0.05, size * 0.78);
    p.quadTo(size * 0.5, size * 0.52, size * 1.05, size * 0.86);
    p.lineTo(size * 1.05, size * 1.02);
    p.quadTo(size * 0.5, size * 0.7, -size * 0.05, size * 0.96);
    p.close();
    canvas.drawPath(p, swoosh);
  }

  // Slight turn so three faces show — the cube must read as a cube at 48px.
  // Negative elevation: world −y renders upward on screen, so a positive angle
  // tips the cube onto its underside. This shows the lit top face instead.
  drawCube(canvas, size * 0.5, size * 0.5, size * 0.42, -0.36, 0.7);
  return surface.makeImageSnapshot().encodeToBytes();
}

const jobs = [
  ['assets/icon.png', 1024, { background: true }],
  ['assets/android-icon-foreground.png', 432, { background: false }],
  ['assets/favicon.png', 48, { background: true }],
];
for (const [file, size, opts] of jobs) {
  const png = render(size, opts);
  if (!png) throw new Error(`encode failed for ${file}`);
  writeFileSync(join(root, file), png);
  console.log(`${file.padEnd(38)} ${size}x${size}  ${(png.length / 1024).toFixed(0)} KB`);
}
