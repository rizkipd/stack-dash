import { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { GameCanvasHost } from '@/components/game/GameCanvasHost';
import { gameplay } from '@/game/config/gameplay';
import { createRenderState, type RenderState } from '@/game/render/renderState';
import { colors } from '@/theme/colors';
import { absoluteFill } from '@/theme/spacing';

type Props = {
  /** Shifts the city along its parallax, so screens don't share a skyline. */
  offset?: number;
};

/**
 * The neon city, rendered behind a menu screen.
 *
 * Reuses the gameplay renderer with an empty render state — no blocks,
 * obstacles or particles — so menus and the game are literally the same
 * artwork rather than two skylines that drift apart as one is tuned.
 *
 * Static: the shared value is written once and never updated, so there is no
 * loop and no per-frame cost.
 */
export function ScreenBackdrop({ offset = 0 }: Props) {
  const { width, height } = useWindowDimensions();

  const state = useSharedValue<RenderState>(
    useMemo(() => {
      const s = createRenderState();
      s.scale = height / gameplay.worldHeight;
      s.distance = offset;
      return s;
    }, [height, offset]),
  );

  return (
    <View style={styles.container} pointerEvents="none">
      <GameCanvasHost state={state} width={width} height={height} />
      {/* Darkening veil: the city is scenery here, and menu text has to win. */}
      <View style={styles.veil} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...absoluteFill, backgroundColor: colors.surface },
  veil: { ...absoluteFill, backgroundColor: 'rgba(9, 8, 20, 0.55)' },
});
