import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { colors } from '@/theme/colors';
import { spacing, typography } from '@/theme/spacing';

/** Main Menu — MVP Screen 2. */
export default function MainMenuScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.titleBlock}>
        <Text style={styles.titleTop}>STACK</Text>
        <Text style={styles.titleBottom}>DASH</Text>
        <Text style={styles.tagline}>AVOID THE WALLS, KEEP YOUR BLOCKS!</Text>
      </View>

      <View style={styles.menu}>
        <PrimaryButton
          label="PLAY"
          variant="primary"
          onPress={() => router.push('/difficulty')}
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
          variant="neutral"
          onPress={() => router.push('/settings')}
        />
      </View>

      <Text style={styles.version}>M0 · Bootstrap</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  titleBlock: { alignItems: 'center', marginTop: spacing.xxl },
  titleTop: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '900',
    letterSpacing: 4,
    lineHeight: typography.title * 1.05,
  },
  titleBottom: {
    color: colors.collect,
    fontSize: typography.title,
    fontWeight: '900',
    letterSpacing: 4,
    lineHeight: typography.title * 1.05,
  },
  tagline: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  menu: { width: '100%', alignItems: 'center', gap: spacing.md },
  version: { color: colors.textDim, fontSize: 11, letterSpacing: 1 },
});
