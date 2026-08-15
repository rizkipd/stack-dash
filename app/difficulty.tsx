import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenBackdrop } from '@/components/ui/ScreenBackdrop';
import { feedback } from '@/feedback';
import { DIFFICULTY_CONFIG } from '@/game/config/difficulty';
import { DIFFICULTIES, type Difficulty } from '@/game/types';
import { colors } from '@/theme/colors';
import { layout, spacing, typography } from '@/theme/spacing';

/**
 * Tier colours, straight from the sheet's level-select mockup: green, amber,
 * red, violet. The ramp is the point — the row of buttons should telegraph
 * escalating danger before a word is read.
 *
 * Same three-tone treatment as `PrimaryButton` (lit top edge, saturated face,
 * exposed dark base) rather than importing it, because these buttons carry a
 * tier colour and a metadata line that the shared component has no concept of.
 */
const TIER: Record<Difficulty, { face: string; top: string; base: string }> = {
  easy: { face: '#22A75A', top: '#4ADE80', base: '#14612F' },
  medium: { face: '#D98A16', top: '#FBBF24', base: '#7C4A08' },
  hard: { face: '#D02F3F', top: '#F87171', base: '#7A1620' },
  insane: { face: '#7C3AED', top: '#A78BFA', base: '#43148F' },
};

/** Difficulty Select — MVP Screen 3. Includes Insane per A-2026-08-15-1. */
export default function DifficultyScreen() {
  return (
    <View style={styles.root}>
      <ScreenBackdrop offset={5200} />

      <SafeAreaView style={styles.container}>
        <Text style={styles.heading}>SELECT DIFFICULTY</Text>

        <View style={styles.list}>
          {DIFFICULTIES.map((difficulty) => {
            const config = DIFFICULTY_CONFIG[difficulty];
            const tone = TIER[difficulty];
            return (
              <Pressable
                key={difficulty}
                accessibilityRole="button"
                accessibilityLabel={`${config.label}, speed ${config.displaySpeed} of 10, starts with ${config.startingBlocks} blocks`}
                onPress={() => {
                  feedback.levelConfirm();
                  router.push({ pathname: '/game', params: { difficulty } });
                }}
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor: tone.base },
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.face, { backgroundColor: tone.face }]}>
                  <View style={[styles.topEdge, { backgroundColor: tone.top }]} />
                  <Text style={styles.label}>{config.label}</Text>
                  <Text style={styles.meta}>
                    SPEED {config.displaySpeed}  ·  {config.startingBlocks} BLOCKS
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => {
            feedback.back();
            router.back();
          }}
          hitSlop={12}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Text style={styles.backGlyph}>←</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  heading: {
    color: colors.text,
    fontSize: typography.screenTitle - 4,
    fontWeight: '900',
    letterSpacing: 2.5,
    marginTop: spacing.md,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  list: { width: '100%', maxWidth: layout.columnWidth, gap: spacing.md },
  button: {
    width: '100%',
    borderRadius: layout.buttonRadius,
    // The exposed sliver of `base` along the bottom is the button's depth.
    paddingBottom: 4,
  },
  face: {
    borderRadius: layout.buttonRadius,
    minHeight: layout.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
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
  // Press sinks the face onto its base; the shadow shrinking is what reads as
  // a physical press.
  pressed: { paddingBottom: 1, transform: [{ translateY: 3 }] },
  label: {
    color: colors.text,
    fontSize: typography.button + 2,
    fontWeight: '900',
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  meta: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    opacity: 0.85,
    marginTop: 2,
  },
  back: {
    width: layout.minTouchTarget + 6,
    height: layout.minTouchTarget + 6,
    borderRadius: 14,
    backgroundColor: 'rgba(31,31,48,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: { color: colors.text, fontSize: 22, fontWeight: '800' },
});
