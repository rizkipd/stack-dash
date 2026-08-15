/**
 * Cuts the app icon and wordmark out of the icon sheet.
 *
 *   node scripts/icon-from-sheet.mjs [path-to-sheet.png]
 *
 * Defaults to ./icon-sheet.png.
 *
 * Everything is cropped from the **1024 panel only** and downscaled from
 * there. The sheet's own 512/256/128 copies are already resampled, so
 * downscaling the largest source is sharper than reusing them.
 *
 * Crop boxes are fractions of the sheet, not pixels, so this works whatever
 * resolution the sheet is saved at.
 */

import { existsSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(process.argv[2] ?? join(root, 'icon-sheet.png'));

if (!existsSync(SRC)) {
  console.error(
    `Sheet not found: ${SRC}\n\n` +
      `Save the icon sheet to the project root as icon-sheet.png, then re-run.`,
  );
  process.exit(1);
}

const ckDir = join(dirname(require.resolve('canvaskit-wasm/package.json')), 'bin', 'full');
const CK = await require(join(ckDir, 'canvaskit.js'))({ locateFile: (f) => join(ckDir, f) });

const image = CK.MakeImageFromEncoded(require('node:fs').readFileSync(SRC));
if (!image) throw new Error('could not decode the sheet');
const SW = image.width();
const SH = image.height();
console.log(`sheet ${SW}x${SH}`);

/**
 * Crop boxes as fractions of the sheet.
 *
 * `icon` is inset *inside* the panel's rounded frame on purpose: iOS and
 * Android apply their own corner mask, and a pre-rounded icon shows dark
 * corners inside the system's rounding.
 */
const BOX = {
  icon: { x: 0.033, y: 0.076, w: 0.455, h: 0.683 },
  logo: { x: 0.105, y: 0.800, w: 0.320, h: 0.180 },
};

function cut(box, size, { square = true, inset = 0 } = {}) {
  const sx = box.x * SW + box.w * SW * inset;
  const sy = box.y * SH + box.h * SH * inset;
  const sw = box.w * SW * (1 - inset * 2);
  const sh = box.h * SH * (1 - inset * 2);

  const outW = size;
  const outH = square ? size : Math.round((size * sh) / sw);

  const surface = CK.MakeSurface(outW, outH);
  const canvas = surface.getCanvas();
  canvas.clear(CK.TRANSPARENT);

  const paint = new CK.Paint();
  paint.setAntiAlias(true);
  canvas.drawImageRect(
    image,
    CK.XYWHRect(sx, sy, sw, sh),
    CK.XYWHRect(0, 0, outW, outH),
    paint,
  );
  const png = surface.makeImageSnapshot().encodeToBytes();
  if (!png) throw new Error('encode failed');
  return { png, outW, outH };
}

const jobs = [
  // Square app icons, all downscaled from the 1024 panel.
  ['assets/icon.png', BOX.icon, 1024, {}],
  ['assets/adaptive-icon.png', BOX.icon, 512, {}],
  // Android adaptive icons are masked to a circle; roughly the middle 66% is
  // guaranteed visible, so the artwork is inset to survive the crop.
  ['assets/android-icon-foreground.png', BOX.icon, 432, { inset: 0.14 }],
  ['assets/favicon.png', BOX.icon, 48, {}],
  // Wordmark keeps its own aspect ratio.
  ['assets/logo.png', BOX.logo, 900, { square: false }],
];

for (const [file, box, size, opts] of jobs) {
  const { png, outW, outH } = cut(box, size, opts);
  writeFileSync(join(root, file), png);
  console.log(`${file.padEnd(38)} ${outW}x${outH}  ${(png.length / 1024).toFixed(0)} KB`);
}

console.log(
  '\nCheck assets/icon.png before shipping — if the crop is off, nudge BOX in this file.',
);
