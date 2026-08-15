/**
 * Copies CanvasKit's WebAssembly binary into `public/`, where Expo's web
 * server exposes it at `/canvaskit.wasm`.
 *
 * React Native Skia needs CanvasKit to render on web. The binary is ~7.7 MB,
 * which is too large to commit for a file that is already a build artefact of
 * an installed dependency — so it is gitignored and regenerated on install.
 *
 * Native builds never touch this; Skia is a real native module on iOS and
 * Android.
 */

import { copyFile, mkdir, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(root, 'public', 'canvaskit.wasm');

try {
  // Resolve through the package so the path survives hoisting changes.
  const source = join(
    dirname(require.resolve('canvaskit-wasm/package.json')),
    'bin',
    'full',
    'canvaskit.wasm',
  );

  await stat(source);
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(source, dest);
  console.log('canvaskit.wasm → public/');
} catch (error) {
  // Web is a convenience target; iOS and Android must never fail to install
  // because a browser asset could not be staged.
  console.warn(
    `Skipped staging canvaskit.wasm (web rendering will not work): ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
}
