import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenBackdrop } from '@/components/ui/ScreenBackdrop';
import { configureFeedback, feedback, initFeedback } from '@/feedback';
import { DIFFICULTIES } from '@/game/types';
import { loadHighScores } from '@/storage/highScore';
import { loadSettings } from '@/storage/settings';
import { colors } from '@/theme/colors';
import { layout, spacing } from '@/theme/spacing';

/** Main Menu — MVP Screen 2. */
export default function MainMenuScreen() {
  const [best, setBest] = useState(0);

  // Preload audio here so the first tap in-game is not what pays for decoding
  // every cue.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [settings, scores] = await Promise.all([
        loadSettings(),
        loadHighScores(),
      ]);
      if (cancelled) return;
      configureFeedback(settings);
      setBest(Math.max(...DIFFICULTIES.map((d) => scores[d])));
      void initFeedback();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.root}>
      <ScreenBackdrop offset={2400} />

      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.bestChip}>
            <Text style={styles.bestLabel}>BEST</Text>
            <Text style={styles.bestValue}>{Math.floor(best / 10)}</Text>
          </View>
        </View>

        <View style={styles.titleBlock}>
          {/*
            The real wordmark, extracted from the design sheet by
            `scripts/extract-logo.mjs`. Text with a shadow was only ever an
            approximation of a lockup that already exists.
          */}
          <Image
            source={require('../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
            accessible
            accessibilityRole="image"
            accessibilityLabel="Stack Dash"
          />
          <Text style={styles.tagline}>AVOID THE WALLS · KEEP YOUR BLOCKS</Text>
        </View>

        <View style={styles.menu}>
          <PrimaryButton
            label="PLAY"
            icon="▶"
            variant="primary"
            onPress={() => {
              feedback.transition();
              router.push('/difficulty');
            }}
          />
          {/*
            Amendment A-2026-08-15-2: the Shop is a locked placeholder.
            Coins, catalogue and purchases remain MVP Non-Goals (docs/FUTURE.md).
          */}
          <PrimaryButton
            label="SHOP"
            variant="secondary"
            locked
            caption="COMING SOON"
          />
          <PrimaryButton
            label="SETTINGS"
            icon="⚙"
            variant="neutral"
            onPress={() => {
              feedback.tap();
              router.push('/settings');
            }}
          />
        </View>

        <View style={styles.iconRow}>
          {[
            { glyph: '📊', label: 'Stats' },
            { glyph: '🏆', label: 'Achievements' },
            { glyph: '⚙', label: 'Settings' },
          ].map((item) => (
            <Pressable
              key={item.label}
              accessibilityRole="button"
              accessibilityLabel={
                item.label === 'Settings' ? item.label : `${item.label}, coming soon`
              }
              onPress={
                item.label === 'Settings'
                  ? () => {
                      feedback.tap();
                      router.push('/settings');
                    }
                  : () => feedback.locked()
              }
              style={({ pressed }) => [
                styles.iconButton,
                // Stats and Achievements are post-MVP (docs/FUTURE.md); shown
                // dimmed so the row matches the sheet without implying they work.
                item.label !== 'Settings' && styles.iconDim,
                pressed && styles.iconPressed,
              ]}
            >
              <Text style={styles.iconGlyph}>{item.glyph}</Text>
            </Pressable>
          ))}
        </View>
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
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  header: { width: '100%', alignItems: 'flex-end' },
  bestChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(22,22,31,0.8)',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  bestLabel: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  bestValue: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  titleBlock: { alignItems: 'center' },
  logo: {
    width: 300,
    height: 191, // 858x546 source, aspect preserved
    marginBottom: spacing.sm,
  },
  tagline: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
  },

  menu: { width: '100%', alignItems: 'center', gap: spacing.md },

  iconRow: { flexDirection: 'row', gap: spacing.md },
  iconButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: layout.minTouchTarget / 2,
    backgroundColor: 'rgba(22,22,31,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDim: { opacity: 0.4 },
  iconPressed: { opacity: 0.6 },
  iconGlyph: { fontSize: 18 },
});
