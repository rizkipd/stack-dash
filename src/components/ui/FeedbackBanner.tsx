import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/theme/colors';

export type BannerKind = 'great' | 'perfect' | 'oops' | 'newBest' | null;

type Props = {
  kind: BannerKind;
  /** Changes on every trigger, so repeats of the same kind still animate. */
  nonce: number;
};

const CONFIG: Record<
  Exclude<BannerKind, null>,
  { text: string; color: string }
> = {
  great: { text: 'GREAT!', color: '#22C55E' },
  perfect: { text: 'PERFECT!', color: colors.collect },
  oops: { text: 'OOPS!', color: colors.accent },
  newBest: { text: 'NEW BEST!', color: colors.accent },
};

/**
 * Transient praise/penalty text, per the reference sheet's feedback panel.
 *
 * Runs entirely on the UI thread via Reanimated: this fires at the exact moment
 * a collision is being resolved, which is the worst possible time to ask the
 * JS thread to do layout work.
 */
export function FeedbackBanner({ kind, nonce }: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!kind) return;
    progress.value = 0;
    progress.value = withSequence(
      withTiming(1, { duration: 140 }),
      withTiming(1, { duration: 380 }),
      withTiming(0, { duration: 260 }),
    );
  }, [kind, nonce, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { scale: 0.8 + progress.value * 0.35 },
      { translateY: (1 - progress.value) * 18 },
    ],
  }));

  if (!kind) return null;

  return (
    <Animated.View style={[styles.wrap, style]} pointerEvents="none">
      <Text style={[styles.text, { color: CONFIG[kind].color }]}>
        {CONFIG[kind].text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: '32%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  text: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
});
