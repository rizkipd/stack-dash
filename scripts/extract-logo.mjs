/**
 * Extracts the STACK DASH wordmark from the design sheet into a reusable asset.
 *
 * The sheet is a flat composite, so the logo comes with its dark city plate
 * baked in. Rather than key it out — which would eat the wordmark's own dark
 * outline — the crop is feathered to transparent at its edges, so it composites
 * cleanly onto both the splash background and the menu's city backdrop.
 *
 * Uses CanvasKit because neither PIL nor sharp is available here, and CanvasKit
 * is already a dependency for Skia on web.
 *
 *   node scripts/extract-logo.mjs
 *
 * Output: assets/logo.png
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const ckDir = join(dirname(require.resolve('canvaskit-wasm/package.json')), 'bin', 'full');
const CanvasKitInit = require(join(ckDir, 'canvaskit.js'));
const CK = await CanvasKitInit({ locateFile: (f) => join(ckDir, f) });

const SRC = join(root, 'image copy 2.png');
const OUT = join(root, 'assets', 'logo.png');

// Logo bounds in the sheet, measured from a probe crop.
const CROP = { x: 58, y: 22, w: 286, h: 182 };
/** Upscale factor. The source region is small; the wordmark is stylised with
 *  heavy glow, so it tolerates resampling better than fine detail would. */
const SCALE = 3;
/** Edge feather, as a fraction of the crop. */
const FEATHER = 0.11;

const bytes = readFileSync(SRC);
const image = CK.MakeImageFromEncoded(bytes);
if (!image) throw new Error('could not decode image copy 2.png');

const W = Math.round(CROP.w * SCALE);
const H = Math.round(CROP.h * SCALE);

const surface = CK.MakeSurface(W, H);
const canvas = surface.getCanvas();
canvas.clear(CK.TRANSPARENT);

const paint = new CK.Paint();
paint.setAntiAlias(true);
canvas.drawImageRect(
  image,
  CK.XYWHRect(CROP.x, CROP.y, CROP.w, CROP.h),
  CK.XYWHRect(0, 0, W, H),
  paint,
);

// Read back and feather the border to transparent.
const pixels = surface.getCanvas().readPixels(0, 0, {
  width: W,
  height: H,
  colorType: CK.ColorType.RGBA_8888,
  alphaType: CK.AlphaType.Unpremul,
  colorSpace: CK.ColorSpace.SRGB,
});
if (!pixels) throw new Error('readPixels failed');

const buf = new Uint8Array(pixels.buffer ?? pixels);
const fx = Math.max(1, Math.round(W * FEATHER));
const fy = Math.max(1, Math.round(H * FEATHER));

for (let y = 0; y < H; y += 1) {
  for (let x = 0; x < W; x += 1) {
    const i = (y * W + x) * 4;
    const edge = Math.min(
      Math.min(x, W - 1 - x) / fx,
      Math.min(y, H - 1 - y) / fy,
      1,
    );
    // Smoothstep, so the fade has no visible banding at its inner edge.
    const t = edge * edge * (3 - 2 * edge);
    buf[i + 3] = Math.round(buf[i + 3] * t);
  }
}

const out = CK.MakeSurface(W, H);
const img = CK.MakeImage(
  {
    width: W,
    height: H,
    colorType: CK.ColorType.RGBA_8888,
    alphaType: CK.AlphaType.Unpremul,
    colorSpace: CK.ColorSpace.SRGB,
  },
  buf,
  W * 4,
);
if (!img) throw new Error('MakeImage failed');
out.getCanvas().clear(CK.TRANSPARENT);
out.getCanvas().drawImage(img, 0, 0, new CK.Paint());

const png = out.makeImageSnapshot().encodeToBytes();
if (!png) throw new Error('encode failed');
writeFileSync(OUT, png);
console.log(`${OUT}  ${W}x${H}  ${(png.length / 1024).toFixed(0)} KB`);
