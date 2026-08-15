/**
 * Difficulty configuration — `docs/GAME_DESIGN.md` §8.
 *
 * Every value here is **tunable balance data owned by the Game Designer**
 * (`docs/RACI.md` row 4), not a game rule. Changing a number here must never
 * require changing engine code.
 */

import type { Difficulty } from '../types';

export type DifficultyConfig = {
  /** Horizontal speed multiplier applied to `gameplay.baseSpeed`. */
  speedMultiplier: number;
  startingBlocks: number;
  /** Vertical opening size as a fraction of playable height. */
  gapFraction: number;
  /** Horizontal distance between obstacle spawns, in world units. */
  spawnSpacing: number;
  /** Probability a spawn slot yields a `+1` collectible. */
  collectibleChance: number;
  /**
   * Player-facing speed number shown in the difficulty picker.
   * Presentation only — the simulation uses `speedMultiplier`.
   * Matches the 4 / 6 / 8 / 10 scale in `image.png`.
   */
  displaySpeed: number;
  label: string;
};

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy: {
    speedMultiplier: 0.85,
    startingBlocks: 10,
    gapFraction: 0.45,
    spawnSpacing: 520,
    collectibleChance: 0.35,
    displaySpeed: 4,
    label: 'EASY',
  },
  medium: {
    speedMultiplier: 1.0,
    startingBlocks: 8,
    gapFraction: 0.36,
    spawnSpacing: 440,
    collectibleChance: 0.25,
    displaySpeed: 6,
    label: 'MEDIUM',
  },
  hard: {
    speedMultiplier: 1.25,
    startingBlocks: 6,
    gapFraction: 0.28,
    spawnSpacing: 380,
    collectibleChance: 0.18,
    displaySpeed: 8,
    label: 'HARD',
  },
  /** Amendment A-2026-08-15-1. Config only — introduces no new systems. */
  insane: {
    speedMultiplier: 1.55,
    startingBlocks: 5,
    gapFraction: 0.22,
    spawnSpacing: 330,
    collectibleChance: 0.14,
    displaySpeed: 10,
    label: 'INSANE',
  },
};

export function getDifficultyConfig(difficulty: Difficulty): DifficultyConfig {
  return DIFFICULTY_CONFIG[difficulty];
}
