import { router } from 'expo-router';
import { useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenBackdrop } from '@/components/ui/ScreenBackdrop';
import { configureFeedback, feedback, initFeedback } from '@/feedback';
import { loadSettings } from '@/storage/settings';
import { colors } from '@/theme/colors';
import { layout, spacing } from '@/theme/spacing';

/** Main Menu — MVP Screen 2. */
export default function MainMenuScreen() {
  // Preload audio here so the first tap in-game is not what pays for decoding
  // every cue.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const settings = await loadSettings();
      if (cancelled) return;
      configureFeedback(settings);
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
    width: layout.minTouchTarget + 6,
    height: layout.minTouchTarget + 6,
    // Rounded squares, matching the sheet — circles read as a different
    // control family from the primary buttons above them.
    borderRadius: 14,
    backgroundColor: 'rgba(31,31,48,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Post-MVP, so visibly subordinate — but not so faint it looks broken.
  iconDim: { opacity: 0.55 },
  iconPressed: { opacity: 0.6 },
  iconGlyph: { fontSize: 18 },
});
