import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { colors } from '@/theme/colors';
import { layout, spacing, typography } from '@/theme/spacing';

/**
 * Game Over — MVP Screen 6.
 *
 * Retry must be one tap and must start a fresh run on the same difficulty
 * (`docs/GAME_DESIGN.md` §10). The fast retry loop is a design pillar.
 */
export default function GameOverScreen() {
  const params = useLocalSearchParams<{ difficulty?: string; score?: string }>();
  const difficulty = (Array.isArray(params.difficulty) ? params.difficulty[0] : params.difficulty) ?? 'medium';
  const score = (Array.isArray(params.score) ? params.score[0] : params.score) ?? '0';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.panel}>
        <Text style={styles.title}>GAME OVER</Text>

        <View style={styles.scoreBlock}>
          <Text style={styles.label}>SCORE</Text>
          <Text style={styles.score}>{score}</Text>
        </View>
        <View style={styles.scoreBlock}>
          <Text style={styles.label}>BEST</Text>
          <Text style={styles.best}>—</Text>
        </View>
        <Text style={styles.note}>Best score persistence lands in M6</Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label="RETRY"
          variant="accent"
          onPress={() => router.dismissTo({ pathname: '/game', params: { difficulty } })}
        />
        <PrimaryButton
          label="HOME"
          variant="neutral"
          onPress={() => router.dismissTo('/')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  panel: { alignItems: 'center', gap: spacing.md },
  title: {
    color: colors.danger,
    fontSize: typography.screenTitle,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  scoreBlock: { alignItems: 'center' },
  label: {
    color: colors.textDim,
    fontSize: typography.hudLabel,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  score: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  best: {
    color: colors.collect,
    fontSize: 28,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  note: { color: colors.textDim, fontSize: 11, marginTop: spacing.sm },
  actions: {
    width: '100%',
    maxWidth: layout.columnWidth,
    alignItems: 'center',
    gap: spacing.md,
  },
});
