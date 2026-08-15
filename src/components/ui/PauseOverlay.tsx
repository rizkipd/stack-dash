import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from './PrimaryButton';
import { colors } from '@/theme/colors';
import { absoluteFill, layout, spacing, typography } from '@/theme/spacing';

type Props = {
  onResume: () => void;
  onRestart: () => void;
  onSettings: () => void;
  onHome: () => void;
};

/**
 * `colors.surface` at 90% — a shade lighter than the Game Over scrim. The
 * frozen play field stays faintly visible, which is what tells the player the
 * run is still there waiting rather than over.
 */
const SCRIM = 'rgba(11, 11, 18, 0.90)';

/**
 * Pause — MVP Screen 5.
 *
 * Screen 6 of the design sheet: PAUSED, then RESUME (`primary`),
 * RESTART (`secondary`), SETTINGS and HOME (`neutral`).
 *
 * An overlay rather than a route, for the same reason as Game Over: the run
 * is suspended, not discarded, so nothing about pausing may unmount the
 * engine host.
 */
export function PauseOverlay({ onResume, onRestart, onSettings, onHome }: Props) {
  // Mounted inside the gameplay `SafeAreaView`, so absolute bounds start
  // *inside* the insets. Pushed back out to the screen edge and re-padded, so
  // the dimming is full-bleed while the controls stay in the safe area.
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
          PAUSED
        </Text>

        <View style={styles.actions}>
          <PrimaryButton label="RESUME" icon="▶" variant="primary" onPress={onResume} />
          <PrimaryButton label="RESTART" icon="↻" variant="secondary" onPress={onRestart} />
          <PrimaryButton label="SETTINGS" icon="⚙" variant="neutral" onPress={onSettings} />
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
    // White, as the sheet draws it; the blue belongs to RESUME directly
    // beneath, and two blues stacked flattens the hierarchy.
    color: colors.text,
    fontSize: typography.screenTitle,
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
    textShadowColor: 'rgba(59, 130, 246, 0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
    marginBottom: spacing.xl,
  },
  actions: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.md,
  },
});
