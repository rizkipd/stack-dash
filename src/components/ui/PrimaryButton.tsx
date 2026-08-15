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
  /** Glyph shown left of the label, matching the sheet's button row. */
  icon?: string;
};

/**
 * Face, lit top edge and shadow per variant.
 *
 * The reference sheet's buttons are not flat fills: each has a lighter top
 * band, a saturated face and a dark base, which is what gives them their
 * moulded look. Three tones per variant reproduce that without a gradient
 * dependency.
 */
const VARIANT: Record<
  ButtonVariant,
  { face: string; top: string; base: string }
> = {
  primary: { face: colors.primary, top: '#60A5FA', base: '#1D4ED8' },
  secondary: { face: colors.secondary, top: '#A78BFA', base: '#5B21B6' },
  neutral: { face: '#3F3F52', top: '#585870', base: '#26263A' },
  accent: { face: colors.accent, top: '#FBBF24', base: '#B45309' },
};

export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  locked = false,
  caption,
  icon,
}: Props) {
  const tone = VARIANT[variant];

  return (
    <Pressable
      onPress={locked ? undefined : onPress}
      disabled={locked}
      accessibilityRole="button"
      accessibilityLabel={locked ? `${label}, coming soon` : label}
      accessibilityState={{ disabled: locked }}
      style={({ pressed }) => [
        styles.wrap,
        { backgroundColor: tone.base },
        locked && styles.locked,
        // Press sinks the button onto its base rather than fading it — the
        // shadow shrinking is what reads as a physical press.
        pressed && !locked && styles.pressed,
      ]}
    >
      <View style={[styles.face, { backgroundColor: tone.face }]}>
        <View style={[styles.topEdge, { backgroundColor: tone.top }]} />
        <View style={styles.content}>
          <Text style={styles.label}>
            {icon ? `${icon}  ` : ''}
            {locked ? `🔒  ${label}` : label}
          </Text>
          {caption ? <Text style={styles.caption}>{caption}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    maxWidth: layout.columnWidth,
    borderRadius: layout.buttonRadius,
    // The exposed sliver of `base` along the bottom is the button's depth.
    paddingBottom: 4,
  },
  face: {
    minHeight: layout.buttonHeight - 4,
    borderRadius: layout.buttonRadius,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    overflow: 'hidden',
  },
  topEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.85,
  },
  content: { alignItems: 'center' },
  // Reduced opacity reads as "deliberately unavailable", not "failed to load".
  locked: { opacity: 0.45 },
  pressed: { paddingBottom: 1, transform: [{ translateY: 3 }] },
  label: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: '800',
    letterSpacing: 1.6,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  caption: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
    opacity: 0.9,
  },
});
