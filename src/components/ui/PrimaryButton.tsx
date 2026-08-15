import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { layout, spacing, typography } from '@/theme/spacing';

export type ButtonVariant = 'primary' | 'secondary' | 'neutral' | 'accent';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  /** Renders the deliberately-unavailable state used by the Shop button. */
  locked?: boolean;
  caption?: string;
};

const VARIANT_COLOR: Record<ButtonVariant, string> = {
  primary: colors.primary,
  secondary: colors.secondary,
  neutral: colors.neutral,
  accent: colors.accent,
};

export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  locked = false,
  caption,
}: Props) {
  return (
    <Pressable
      onPress={locked ? undefined : onPress}
      disabled={locked}
      accessibilityRole="button"
      accessibilityLabel={locked ? `${label}, coming soon` : label}
      accessibilityState={{ disabled: locked }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: VARIANT_COLOR[variant] },
        locked && styles.locked,
        pressed && !locked && styles.pressed,
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.label}>
          {locked ? `🔒  ${label}` : label}
        </Text>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    maxWidth: layout.columnWidth,
    minHeight: layout.buttonHeight,
    borderRadius: layout.buttonRadius,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  content: { alignItems: 'center' },
  // Reduced opacity reads as "deliberately unavailable", not "failed to load".
  locked: { opacity: 0.45 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  label: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  caption: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 2,
    opacity: 0.9,
  },
});
