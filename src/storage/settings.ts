/**
 * Local settings persistence. MVP is local-only (`docs/ARCHITECTURE.md` §10).
 *
 * Every read tolerates corrupt or missing data and falls back to defaults —
 * QA Plan stress case "corrupt/missing local save data". A settings read must
 * never be able to prevent the app from booting.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Difficulty } from '../game/types';
import { DIFFICULTIES } from '../game/types';

const KEY = 'stackdash.settings.v1';

export type Settings = {
  soundEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
  lastDifficulty: Difficulty;
};

export const DEFAULT_SETTINGS: Settings = {
  soundEnabled: true,
  musicEnabled: true,
  hapticsEnabled: true,
  lastDifficulty: 'medium',
};

function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && DIFFICULTIES.includes(value as Difficulty);
}

/** Validates field by field; a partially corrupt record keeps its good fields. */
export function parseSettings(raw: string | null): Settings {
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return { ...DEFAULT_SETTINGS };
    }
    const record = parsed as Record<string, unknown>;
    return {
      soundEnabled:
        typeof record.soundEnabled === 'boolean'
          ? record.soundEnabled
          : DEFAULT_SETTINGS.soundEnabled,
      musicEnabled:
        typeof record.musicEnabled === 'boolean'
          ? record.musicEnabled
          : DEFAULT_SETTINGS.musicEnabled,
      hapticsEnabled:
        typeof record.hapticsEnabled === 'boolean'
          ? record.hapticsEnabled
          : DEFAULT_SETTINGS.hapticsEnabled,
      lastDifficulty: isDifficulty(record.lastDifficulty)
        ? record.lastDifficulty
        : DEFAULT_SETTINGS.lastDifficulty,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function loadSettings(): Promise<Settings> {
  try {
    return parseSettings(await AsyncStorage.getItem(KEY));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // A failed settings write must never interrupt play.
  }
}
