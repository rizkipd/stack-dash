/**
 * Best-distance persistence, tracked per difficulty
 * (`docs/ARCHITECTURE.md` §10).
 *
 * As with settings, corrupt data degrades to zero rather than throwing.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Difficulty } from '../game/types';
import { DIFFICULTIES } from '../game/types';

const KEY = 'stackdash.highscore.v1';

export type HighScores = Record<Difficulty, number>;

export const EMPTY_HIGH_SCORES: HighScores = {
  easy: 0,
  medium: 0,
  hard: 0,
  insane: 0,
};

function sanitiseScore(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

export function parseHighScores(raw: string | null): HighScores {
  if (!raw) return { ...EMPTY_HIGH_SCORES };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return { ...EMPTY_HIGH_SCORES };
    }
    const record = parsed as Record<string, unknown>;
    const result = { ...EMPTY_HIGH_SCORES };
    for (const difficulty of DIFFICULTIES) {
      result[difficulty] = sanitiseScore(record[difficulty]);
    }
    return result;
  } catch {
    return { ...EMPTY_HIGH_SCORES };
  }
}

export async function loadHighScores(): Promise<HighScores> {
  try {
    return parseHighScores(await AsyncStorage.getItem(KEY));
  } catch {
    return { ...EMPTY_HIGH_SCORES };
  }
}

/**
 * Records `distance` if it beats the stored best.
 * Returns the updated table and whether a record was set, so the Game Over
 * screen can celebrate a new best without a second read.
 */
export async function recordDistance(
  difficulty: Difficulty,
  distance: number,
): Promise<{ scores: HighScores; isNewBest: boolean }> {
  const scores = await loadHighScores();
  const candidate = sanitiseScore(distance);
  const isNewBest = candidate > scores[difficulty];

  if (isNewBest) {
    scores[difficulty] = candidate;
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(scores));
    } catch {
      // Losing a high score is bad; crashing the Game Over screen is worse.
    }
  }

  return { scores, isNewBest };
}
