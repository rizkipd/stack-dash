import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createGameState } from '@/game/engine/GameState';
import { DIFFICULTIES, type Difficulty } from '@/game/types';
import { colors } from '@/theme/colors';
import { spacing, typography } from '@/theme/spacing';

function parseDifficulty(value: string | string[] | undefined): Difficulty {
  const raw = Array.isArray(value) ? value[0] : value;
  return DIFFICULTIES.includes(raw as Difficulty) ? (raw as Difficulty) : 'medium';
}

/**
 * Gameplay — MVP Screen 4.
 *
 * M0 renders the HUD shell and proves state construction and navigation only.
 * The Skia canvas, drag input, obstacles and collision arrive in M1-M3.
 */
export default function GameScreen() {
  const params = useLocalSearchParams<{ difficulty?: string }>();
  const difficulty = parseDifficulty(params.difficulty);

  // Proves the simulation is constructible from a screen without the screen
  // owning any game rules (CLAUDE.md Architecture Rule 2).
  const state = useMemo(() => createGameState(difficulty), [difficulty]);

  return (
    <SafeAreaView style={styles.container}>
      {/* HUD priority order is fixed: distance, blocks, pause. */}
      <View style={styles.hud}>
        <View>
          <Text style={styles.hudLabel}>SCORE</Text>
          <Text style={styles.hudValue}>{Math.floor(state.distance)}</Text>
        </View>
        <View style={styles.hudRight}>
          <Text style={styles.hudLabel}>BLOCKS</Text>
          <Text style={styles.hudValue}>{state.stack.blocks.length}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pause"
            onPress={() => router.push('/game-over')}
            style={styles.pauseButton}
          >
            <Text style={styles.pauseGlyph}>❚❚</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.playfield}>
        <Text style={styles.placeholder}>GAMEPLAY CANVAS</Text>
        <Text style={styles.placeholderMeta}>
          {difficulty.toUpperCase()} · {state.stack.blocks.length} blocks · phase {state.phase}
        </Text>
        <Text style={styles.placeholderNote}>Skia render layer lands in M1-M3</Text>
      </View>

      <Pressable onPress={() => router.dismissTo('/')} accessibilityRole="button">
        <Text style={styles.back}>← HOME</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  hud: { flexDirection: 'row', justifyContent: 'space-between' },
  hudRight: { alignItems: 'flex-end' },
  hudLabel: {
    color: colors.textDim,
    fontSize: typography.hudLabel,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  hudValue: {
    color: colors.text,
    fontSize: typography.hudValue,
    fontWeight: '800',
    // Tabular figures stop the per-frame distance counter from shimmering.
    fontVariant: ['tabular-nums'],
  },
  pauseButton: {
    marginTop: spacing.sm,
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseGlyph: { color: colors.text, fontSize: 14, fontWeight: '700' },
  playfield: {
    flex: 1,
    marginVertical: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.skyline,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  placeholder: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  placeholderMeta: { color: colors.collect, fontSize: 12, fontWeight: '600' },
  placeholderNote: { color: colors.textDim, fontSize: 11, marginTop: spacing.xs },
  back: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
});
