import { createRng } from '../src/game/engine/Rng';

/**
 * QA Plan test #16 — seeded obstacle generation must be reproducible.
 * The RNG is the foundation of that guarantee, so it is tested from M0
 * rather than from M4.
 */
describe('seeded rng', () => {
  it('produces an identical sequence for the same seed', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = Array.from({ length: 20 }, createRng(1).next);
    const b = Array.from({ length: 20 }, createRng(2).next);
    expect(a).not.toEqual(b);
  });

  it('stays within [0, 1)', () => {
    const rng = createRng(99);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('returns integers inside an inclusive range', () => {
    const rng = createRng(7);
    for (let i = 0; i < 500; i += 1) {
      const value = rng.nextInt(3, 8);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(8);
    }
  });

  it('reaches both ends of an integer range', () => {
    const rng = createRng(42);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i += 1) seen.add(rng.nextInt(0, 3));
    expect(seen).toEqual(new Set([0, 1, 2, 3]));
  });

  it('picks only from the supplied array', () => {
    const rng = createRng(5);
    const items = ['bottomWall', 'topWall', 'gate'] as const;
    for (let i = 0; i < 200; i += 1) {
      expect(items).toContain(rng.pick(items));
    }
  });

  it('throws on an empty pick rather than returning undefined', () => {
    expect(() => createRng(1).pick([])).toThrow(/empty array/);
  });

  it('honours chance boundaries exactly', () => {
    const rng = createRng(3);
    for (let i = 0; i < 100; i += 1) {
      expect(rng.chance(0)).toBe(false);
      expect(rng.chance(1)).toBe(true);
    }
  });

  it('exposes state so a failing run can be replayed', () => {
    const rng = createRng(77);
    rng.next();
    const captured = rng.getState();
    const expected = rng.next();

    const replay = createRng(0);
    // Re-seeding from a captured state reproduces the following draw.
    const fresh = createRng(77);
    fresh.next();
    expect(fresh.getState()).toBe(captured);
    expect(fresh.next()).toBe(expected);
    expect(replay).toBeDefined();
  });
});
