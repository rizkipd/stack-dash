import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { StyleSheet, View } from 'react-native';

import type { GameCanvasHostProps } from './GameCanvasHost';
import { colors } from '@/theme/colors';
import { absoluteFill } from '@/theme/spacing';

/**
 * Gameplay canvas — web.
 *
 * Skia on web is CanvasKit: a ~7.7 MB WebAssembly binary that must finish
 * loading before any Skia component mounts. `WithSkiaWeb` handles that, so the
 * canvas module is imported lazily and only after CanvasKit is ready.
 *
 * Only the canvas is gated, not the screen — the HUD, pause and Game Over
 * overlays are plain React Native views and render straight away.
 */
export function GameCanvasHost(props: GameCanvasHostProps) {
  return (
    <WithSkiaWeb
      getComponent={() => import('./GameCanvas')}
      componentProps={props}
      fallback={<View style={styles.fallback} />}
      // Served from `public/`, staged by scripts/copy-canvaskit.mjs.
      opts={{ locateFile: (file: string) => `/${file}` }}
    />
  );
}

const styles = StyleSheet.create({
  fallback: { ...absoluteFill, backgroundColor: colors.bgMid },
});
