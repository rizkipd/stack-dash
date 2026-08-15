import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

type Props = {
  score: number;
  blocks: number;
  onPause: () => void;
};

/**
 * Gameplay HUD.
 *
 * Deliberately sparse, matching the gameplay mockup in `image copy 2.png`:
 * a bare score top-left, a cube glyph with the block count top-right, and the
 * pause button beneath it. Nothing else.
 *
 * An earlier version carried SCORE / BEST / DISTANCE / BLOCKS chips. That is
 * the *asset* panel of the sheet, not its gameplay screen — during a run the
 * player is reading walls, and every extra chip competes with the thing that
 * actually decides whether they live.
 *
 * The block count turns amber then red as the stack runs down (the sheet's
 * "Low Blocks" state). That warning is the one piece of HUD a player must
 * never miss.
 */
export function HUD({ score, blocks, onPause }: Props) {
  const danger = blocks <= 2;
  const warning = blocks <= 4;
  const countColor = danger ? colors.danger : warning ? colors.accent : colors.text;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Text style={styles.score}>{score}</Text>

      <View style={styles.right}>
        <View style={styles.countRow}>
          {/* Cube glyph, drawn from three faces so it echoes the player's
              blocks rather than sitting as a flat square. */}
          <View style={styles.cube}>
            <View style={styles.cubeTop} />
            <View style={styles.cubeSide} />
          </View>
          <Text style={[styles.count, { color: countColor }]}>×{blocks}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pause"
          onPress={onPause}
          hitSlop={10}
          style={({ pressed }) => [styles.pause, pressed && styles.pressed]}
        >
          <Text style={styles.pauseGlyph}>❚❚</Text>
        </Pressable>
      </View>
    </View>
  );
}

const CUBE = 22;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  score: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0.5,
    // Tabular figures stop the per-frame counter from shimmering.
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  right: { alignItems: 'flex-end', gap: spacing.sm },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cube: {
    width: CUBE,
    height: CUBE,
    borderRadius: 4,
    backgroundColor: colors.block,
  },
  cubeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: CUBE * 0.3,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    backgroundColor: colors.blockLight,
  },
  cubeSide: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: CUBE * 0.26,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: colors.blockDark,
  },
  count: {
    fontSize: 24,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  pause: {
    width: 44,
    height: 44,
    borderRadius: 12,
    // Purple, as in the mockup — it reads as a control rather than as part of
    // the play field.
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  pauseGlyph: { color: colors.text, fontSize: 15, fontWeight: '800' },
});
