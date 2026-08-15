import { DEFAULT_SETTINGS, parseSettings } from '../src/storage/settings';
import { EMPTY_HIGH_SCORES, parseHighScores } from '../src/storage/highScore';

/**
 * QA Plan stress case: "corrupt/missing local save data".
 *
 * These exercise the pure parse functions, so no AsyncStorage mock is needed.
 * A bad save file must degrade to defaults — never throw, never block boot.
 */
describe('settings parsing', () => {
  it('returns defaults for missing data', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('returns defaults for malformed JSON', () => {
    expect(parseSettings('{ not json')).toEqual(DEFAULT_SETTINGS);
  });

  it('returns defaults for a JSON primitive', () => {
    expect(parseSettings('42')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('null')).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips a valid record', () => {
    const stored = {
      soundEnabled: false,
      musicEnabled: false,
      hapticsEnabled: true,
      lastDifficulty: 'insane',
    };
    expect(parseSettings(JSON.stringify(stored))).toEqual(stored);
  });

  it('keeps good fields when others are corrupt', () => {
    const result = parseSettings(
      JSON.stringify({ soundEnabled: false, musicEnabled: 'yes', lastDifficulty: 'wrong' }),
    );
    expect(result.soundEnabled).toBe(false);
    expect(result.musicEnabled).toBe(DEFAULT_SETTINGS.musicEnabled);
    expect(result.lastDifficulty).toBe(DEFAULT_SETTINGS.lastDifficulty);
  });

  it('rejects a difficulty value that is not a known tier', () => {
    expect(parseSettings(JSON.stringify({ lastDifficulty: 'nightmare' })).lastDifficulty)
      .toBe(DEFAULT_SETTINGS.lastDifficulty);
  });
});

describe('high score parsing', () => {
  it('returns zeroes for missing or malformed data', () => {
    expect(parseHighScores(null)).toEqual(EMPTY_HIGH_SCORES);
    expect(parseHighScores('nonsense')).toEqual(EMPTY_HIGH_SCORES);
  });

  it('round-trips valid scores', () => {
    const stored = { easy: 100, medium: 250, hard: 80, insane: 12 };
    expect(parseHighScores(JSON.stringify(stored))).toEqual(stored);
  });

  it('zeroes negative, non-numeric and non-finite scores', () => {
    const result = parseHighScores(
      JSON.stringify({ easy: -5, medium: 'lots', hard: Infinity, insane: NaN }),
    );
    expect(result).toEqual(EMPTY_HIGH_SCORES);
  });

  it('floors fractional distances', () => {
    expect(parseHighScores(JSON.stringify({ easy: 99.9 })).easy).toBe(99);
  });

  it('fills in tiers absent from an older save', () => {
    // A save written before Insane existed must still load.
    expect(parseHighScores(JSON.stringify({ easy: 10, medium: 20, hard: 30 }))).toEqual({
      easy: 10,
      medium: 20,
      hard: 30,
      insane: 0,
    });
  });
});
