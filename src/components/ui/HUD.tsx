import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { spacing, typography } from '@/theme/spacing';

type Props = {
  score: number;
  best: number;
  blocks: number;
  distance: number;
  onPause: () => void;
};

/**
 * Gameplay HUD.
 *
 * Layout follows the reference sheet: SCORE top-left, BEST top-right,
 * DISTANCE and the block count beneath. Priority order is fixed by
 * `docs/GAME_DESIGN.md`: distance, remaining blocks, pause.
 *
 * The block count turns amber then red as the stack runs down — the "Low
 * Blocks" state in the sheet. That warning is the one piece of HUD a player
 * must never miss.
 */
export function HUD({ score, best, blocks, distance, onPause }: Props) {
  const danger = blocks <= 2;
  const warning = blocks <= 4;
  const blockColor = danger ? colors.danger : warning ? colors.accent : colors.text;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.row}>
        <View>
          <Text style={styles.label}>SCORE</Text>
          <Text style={styles.score}>{score}</Text>
        </View>

        <View style={styles.right}>
          <Text style={styles.label}>BEST</Text>
          <Text style={styles.best}>{best}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>DISTANCE</Text>
          <Text style={styles.chipValue}>{distance} m</Text>
        </View>

        <View style={styles.rightRow}>
          <View style={[styles.chip, styles.blockChip]}>
            <Text style={styles.chipLabel}>BLOCKS</Text>
            <Text style={[styles.chipValue, { color: blockColor }]}>{blocks}</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pause"
            onPress={onPause}
            hitSlop={8}
            style={({ pressed }) => [styles.pause, pressed && styles.pressed]}
          >
            <Text style={styles.pauseGlyph}>❚❚</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  right: { alignItems: 'flex-end' },
  rightRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: {
    color: colors.textDim,
    fontSize: typography.hudLabel,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  score: {
    color: colors.text,
    fontSize: typography.hudValue,
    fontWeight: '800',
    // Tabular figures stop the per-frame counter from shimmering.
    fontVariant: ['tabular-nums'],
  },
  best: {
    color: colors.collect,
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  chip: {
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    opacity: 0.94,
  },
  blockChip: { minWidth: 62, alignItems: 'center' },
  chipLabel: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  chipValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  pause: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  pauseGlyph: { color: colors.text, fontSize: 14, fontWeight: '700' },
});
