import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from './PrimaryButton';
import { colors } from '@/theme/colors';
import { absoluteFill, layout, spacing, typography } from '@/theme/spacing';

type Props = {
  onResume: () => void;
  onRestart: () => void;
  onSettings: () => void;
  onHome: () => void;
};

/** Pause — MVP Screen 5. Rendered as an overlay so the run is never torn down. */
export function PauseOverlay({ onResume, onRestart, onSettings, onHome }: Props) {
  return (
    <View style={styles.backdrop}>
      <Text style={styles.title}>PAUSED</Text>
      <View style={styles.actions}>
        <PrimaryButton label="RESUME" variant="primary" onPress={onResume} />
        <PrimaryButton label="RESTART" variant="secondary" onPress={onRestart} />
        <PrimaryButton label="SETTINGS" variant="neutral" onPress={onSettings} />
        <PrimaryButton label="HOME" variant="neutral" onPress={onHome} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...absoluteFill,
    backgroundColor: 'rgba(11, 11, 18, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  title: {
    color: colors.primary,
    fontSize: typography.screenTitle,
    fontWeight: '900',
    letterSpacing: 3,
  },
  actions: {
    width: '100%',
    maxWidth: layout.columnWidth,
    alignItems: 'center',
    gap: spacing.md,
  },
});
