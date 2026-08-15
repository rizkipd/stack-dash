import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { feedback } from '@/feedback';
import { DIFFICULTY_CONFIG } from '@/game/config/difficulty';
import { DIFFICULTIES, type Difficulty } from '@/game/types';
import { colors } from '@/theme/colors';
import { layout, spacing, typography } from '@/theme/spacing';

const TIER_COLOR: Record<Difficulty, string> = {
  easy: '#22C55E',
  medium: colors.accent,
  hard: colors.danger,
  insane: colors.secondary,
};

/** Difficulty Select — MVP Screen 3. Includes Insane per A-2026-08-15-1. */
export default function DifficultyScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>SELECT DIFFICULTY</Text>

      <View style={styles.list}>
        {DIFFICULTIES.map((difficulty) => {
          const config = DIFFICULTY_CONFIG[difficulty];
          return (
            <Pressable
              key={difficulty}
              accessibilityRole="button"
              accessibilityLabel={`${config.label}, speed ${config.displaySpeed}, ${config.startingBlocks} starting blocks`}
              onPress={() => {
                feedback.levelConfirm();
                router.push({ pathname: '/game', params: { difficulty } });
              }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={[styles.tierBar, { backgroundColor: TIER_COLOR[difficulty] }]} />
              <View style={styles.rowBody}>
                <Text style={[styles.tierLabel, { color: TIER_COLOR[difficulty] }]}>
                  {config.label}
                </Text>
                <Text style={styles.tierMeta}>
                  SPEED {config.displaySpeed}  ·  {config.startingBlocks} BLOCKS
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => {
          feedback.back();
          router.back();
        }}
        accessibilityRole="button"
      >
        <Text style={styles.back}>← BACK</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  heading: {
    color: colors.text,
    fontSize: typography.screenTitle,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: spacing.lg,
  },
  list: { width: '100%', maxWidth: layout.columnWidth, gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: layout.buttonRadius,
    minHeight: layout.buttonHeight,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.8 },
  tierBar: { width: 6, alignSelf: 'stretch' },
  rowBody: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  tierLabel: { fontSize: typography.button, fontWeight: '800', letterSpacing: 1.5 },
  tierMeta: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 2,
  },
  back: { color: colors.textDim, fontSize: 13, fontWeight: '700', letterSpacing: 1.5 },
});
