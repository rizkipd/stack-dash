import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings,
} from '@/storage/settings';
import { colors } from '@/theme/colors';
import { layout, spacing, typography } from '@/theme/spacing';

type ToggleKey = 'soundEnabled' | 'musicEnabled' | 'hapticsEnabled';

const TOGGLES: { key: ToggleKey; label: string }[] = [
  { key: 'soundEnabled', label: 'SOUND EFFECTS' },
  { key: 'musicEnabled', label: 'MUSIC' },
  { key: 'hapticsEnabled', label: 'HAPTICS' },
];

/**
 * Settings — MVP Screen 7.
 *
 * Sound, music and haptics toggle independently, per the accessibility
 * requirement in `docs/ART_DIRECTION.md` §7.
 */
export default function SettingsScreen() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    void loadSettings().then((loaded) => {
      if (!cancelled) setSettings(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (key: ToggleKey) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    void saveSettings(next);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>SETTINGS</Text>

      <View style={styles.list}>
        {TOGGLES.map(({ key, label }) => (
          <View key={key} style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Switch
              value={settings[key]}
              onValueChange={() => toggle(key)}
              accessibilityLabel={label}
              trackColor={{ false: colors.neutral, true: colors.primary }}
              thumbColor={colors.text}
            />
          </View>
        ))}
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
    justifyContent: 'space-between',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  heading: {
    color: colors.text,
    fontSize: typography.screenTitle,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: spacing.lg,
  },
  list: { width: '100%', maxWidth: layout.columnWidth, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: layout.buttonRadius,
    minHeight: layout.minTouchTarget + 8,
    paddingHorizontal: spacing.md,
  },
  rowLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  back: { color: colors.textDim, fontSize: 13, fontWeight: '700', letterSpacing: 1.5 },
});
