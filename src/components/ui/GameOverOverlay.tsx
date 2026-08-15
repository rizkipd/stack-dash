import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from './PrimaryButton';
import { colors } from '@/theme/colors';
import { absoluteFill, layout, spacing, typography } from '@/theme/spacing';

type Props = {
  /** Run score, already in display units. */
  score: number;
  /** Best score for this difficulty, already in display units. */
  best: number;
  onRetry: () => void;
  onHome: () => void;
};

/** `colors.surface` at 93%. Near-opaque: the run must read as *stopped*. */
const SCRIM = 'rgba(11, 11, 18, 0.93)';

/**
 * `colors.primary` at 35% — the thin lit rim the sheet draws around every
 * SCORE / BEST / DISTANCE chip. It is what separates the readout from the
 * scrim without adding a second solid block of colour.
 */
const CHIP_RIM = 'rgba(59, 130, 246, 0.35)';

/**
 * Game Over — MVP Screen 6.
 *
 * Laid out from screen 5 of the design sheet: GAME OVER in `danger`, then the
 * SCORE / BEST readout in a chip, a trophy, then RETRY and HOME.
 *
 * An **overlay, not a route**. Retry has to be one tap and must not tear the
 * run down and rebuild it (`docs/GAME_DESIGN.md` §2, pillar 5); pushing a
 * screen would unmount the engine host and pay for a fresh mount on every
 * death.
 *
 * Deliberately motionless. Nothing here animates in, so there is no entrance
 * to suppress under reduce-motion, and the RETRY target is hittable the
 * instant it appears rather than at the end of a fade.
 */
export function GameOverOverlay({ score, best, onRetry, onHome }: Props) {
  // The overlay is mounted inside the gameplay `SafeAreaView`, so its absolute
  // bounds start *inside* the insets — which would leave a live strip of play
  // field showing above the notch. The scrim is pushed back out to the screen
  // edge and the content re-padded, so the dimming is full-bleed while the
  // text and buttons stay inside the safe area.
  const insets = useSafeAreaInsets();

  return (
    <View
      accessibilityViewIsModal
      style={[
        styles.backdrop,
        {
          top: -insets.top,
          bottom: -insets.bottom,
          left: -insets.left,
          right: -insets.right,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <View style={styles.column}>
        <Text
          style={styles.title}
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
        >
          GAME OVER
        </Text>

        {/* Grouped for screen readers: four separate labels would be read as
            four fragments, "SCORE", "2450", "BEST", "3250". */}
        <View
          style={styles.card}
          accessible
          accessibilityRole="text"
          accessibilityLabel={`Score ${score}. Best ${best}.`}
        >
          <Text style={styles.label}>SCORE</Text>
          <Text style={styles.score}>{score}</Text>

          <View style={styles.rule} />

          <Text style={styles.label}>BEST</Text>
          <Text style={styles.best}>{best}</Text>

          <Text style={styles.trophy}>🏆</Text>
        </View>

        <View style={styles.actions}>
          <PrimaryButton label="RETRY" icon="↻" variant="accent" onPress={onRetry} />
          <PrimaryButton label="HOME" icon="🏠" variant="neutral" onPress={onHome} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...absoluteFill,
    backgroundColor: SCRIM,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  column: {
    width: '100%',
    maxWidth: layout.columnWidth,
    alignItems: 'center',
  },
  title: {
    color: colors.danger,
    fontSize: typography.screenTitle,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
    // Ambient red glow, not a flash — it seats the word in the neon scene
    // without washing out anything behind it.
    textShadowColor: 'rgba(239, 68, 68, 0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
    marginBottom: spacing.lg,
  },
  card: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CHIP_RIM,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  label: {
    color: colors.textDim,
    fontSize: typography.hudLabel,
    fontWeight: '700',
    letterSpacing: 2,
  },
  score: {
    color: colors.text,
    fontSize: 46,
    fontWeight: '900',
    // Tabular figures: the value is frozen here, but it must not re-flow
    // relative to the same number shown live in the HUD.
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  rule: {
    width: 72,
    height: 1,
    backgroundColor: CHIP_RIM,
    marginVertical: spacing.md,
  },
  best: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  trophy: { fontSize: 26, marginTop: spacing.sm },
  actions: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
});
