import {
  DIFFICULTY_CONFIG,
  getDifficultyConfig,
} from '../src/game/config/difficulty';
import { DIFFICULTIES, type Difficulty } from '../src/game/types';

/** Easy → Insane, in intended order of increasing pressure. */
const ORDERED: Difficulty[] = ['easy', 'medium', 'hard', 'insane'];

describe('difficulty configuration', () => {
  it('defines every declared difficulty', () => {
    for (const difficulty of DIFFICULTIES) {
      expect(getDifficultyConfig(difficulty)).toBeDefined();
    }
    expect(Object.keys(DIFFICULTY_CONFIG)).toHaveLength(DIFFICULTIES.length);
  });

  it('includes Insane (Amendment A-2026-08-15-1)', () => {
    expect(DIFFICULTY_CONFIG.insane).toBeDefined();
    expect(DIFFICULTY_CONFIG.insane.label).toBe('INSANE');
  });

  // Each tier must actually be harder than the last, or the picker lies.
  it('increases speed monotonically', () => {
    for (let i = 1; i < ORDERED.length; i += 1) {
      const prev = DIFFICULTY_CONFIG[ORDERED[i - 1]!];
      const curr = DIFFICULTY_CONFIG[ORDERED[i]!];
      expect(curr.speedMultiplier).toBeGreaterThan(prev.speedMultiplier);
    }
  });

  it('decreases starting blocks monotonically', () => {
    for (let i = 1; i < ORDERED.length; i += 1) {
      expect(DIFFICULTY_CONFIG[ORDERED[i]!].startingBlocks).toBeLessThan(
        DIFFICULTY_CONFIG[ORDERED[i - 1]!].startingBlocks,
      );
    }
  });

  it('narrows the gap monotonically', () => {
    for (let i = 1; i < ORDERED.length; i += 1) {
      expect(DIFFICULTY_CONFIG[ORDERED[i]!].gapFraction).toBeLessThan(
        DIFFICULTY_CONFIG[ORDERED[i - 1]!].gapFraction,
      );
    }
  });

  it('tightens spawn spacing monotonically', () => {
    for (let i = 1; i < ORDERED.length; i += 1) {
      expect(DIFFICULTY_CONFIG[ORDERED[i]!].spawnSpacing).toBeLessThan(
        DIFFICULTY_CONFIG[ORDERED[i - 1]!].spawnSpacing,
      );
    }
  });

  it('keeps every tier survivable on its face', () => {
    for (const difficulty of DIFFICULTIES) {
      const config = DIFFICULTY_CONFIG[difficulty];
      expect(config.startingBlocks).toBeGreaterThan(0);
      // A gap must stay a meaningful fraction of the playfield. The fairness
      // validator enforces the real rule in M4; this catches a bad edit early.
      expect(config.gapFraction).toBeGreaterThan(0.15);
      expect(config.gapFraction).toBeLessThan(1);
      expect(config.collectibleChance).toBeGreaterThanOrEqual(0);
      expect(config.collectibleChance).toBeLessThanOrEqual(1);
    }
  });

  it('matches the display speeds shown in image.png', () => {
    expect(ORDERED.map((d) => DIFFICULTY_CONFIG[d].displaySpeed)).toEqual([4, 6, 8, 10]);
  });
});
