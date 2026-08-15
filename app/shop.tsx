import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { spacing, typography } from '@/theme/spacing';

/**
 * Shop — locked placeholder (Amendment A-2026-08-15-2).
 *
 * This screen exists to preserve the Main Menu composition from `image.png`.
 * Coins, a catalogue, skins, ads and IAP remain **MVP Non-Goals**; they are
 * specified in `docs/FUTURE.md` and gated on the core loop being proven fun.
 *
 * Do not implement commerce here without a dated Product Owner amendment.
 */
export default function ShopScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.panel}>
        <Text style={styles.lock}>🔒</Text>
        <Text style={styles.title}>SHOP</Text>
        <Text style={styles.subtitle}>COMING SOON</Text>
        <Text style={styles.body}>
          Skins and cosmetics arrive after the core game is finished.
        </Text>
      </View>

      <Pressable onPress={() => router.back()} accessibilityRole="button">
        <Text style={styles.back}>← BACK</Text>
      </Pressable>
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
  panel: { alignItems: 'center', gap: spacing.sm, opacity: 0.6 },
  lock: { fontSize: 48 },
  title: {
    color: colors.secondary,
    fontSize: typography.screenTitle,
    fontWeight: '900',
    letterSpacing: 3,
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  body: {
    color: colors.textDim,
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 260,
    marginTop: spacing.md,
  },
  back: { color: colors.textDim, fontSize: 13, fontWeight: '700', letterSpacing: 1.5 },
});
