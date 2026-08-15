import { GameEngine } from '../src/game/engine/GameEngine';
import { gameplay } from '../src/game/config/gameplay';
import { DIFFICULTY_CONFIG } from '../src/game/config/difficulty';
import { DIFFICULTIES } from '../src/game/types';

const FRAME = 1 / 60;

function run(engine: GameEngine, seconds: number, dt = FRAME) {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i += 1) engine.update(dt);
}

describe('lifecycle', () => {
  it('starts in ready and does not simulate until started', () => {
    const engine = new GameEngine({ difficulty: 'medium', seed: 1 });
    expect(engine.phase).toBe('ready');
    run(engine, 1);
    expect(engine.distance).toBe(0);
    expect(engine.obstacles).toHaveLength(0);
  });

  // QA Plan #13.
  it('freezes the simulation while paused', () => {
    const engine = new GameEngine({ difficulty: 'medium', seed: 2 });
    engine.start();
    run(engine, 1);
    const distance = engine.distance;

    engine.pause();
    run(engine, 2);
    expect(engine.distance).toBe(distance);

    // QA Plan #14 — and resumes cleanly.
    engine.resume();
    run(engine, 0.5);
    expect(engine.distance).toBeGreaterThan(distance);
  });

  // QA Plan #10.
  it('fully resets on restart', () => {
    const engine = new GameEngine({ difficulty: 'hard', seed: 3 });
    engine.start();
    run(engine, 6);
    expect(engine.distance).toBeGreaterThan(0);

    engine.reset('hard', 3);
    expect(engine.phase).toBe('ready');
    expect(engine.distance).toBe(0);
    expect(engine.obstacles).toHaveLength(0);
    expect(engine.collectibles).toHaveLength(0);
    expect(engine.blocksLost).toBe(0);
    expect(engine.shake).toBe(0);
    expect(engine.blockCount).toBe(DIFFICULTY_CONFIG.hard.startingBlocks);
    expect(engine.particles.every((p) => !p.active)).toBe(true);
  });

  it('can switch difficulty on reset', () => {
    const engine = new GameEngine({ difficulty: 'easy', seed: 4 });
    engine.reset('insane', 4);
    expect(engine.difficulty).toBe('insane');
    expect(engine.blockCount).toBe(DIFFICULTY_CONFIG.insane.startingBlocks);
  });
});

describe('game over', () => {
  // QA Plan #9 — the single most important lifecycle guarantee.
  it('fires exactly once when the stack empties', () => {
    const engine = new GameEngine({ difficulty: 'medium', seed: 5 });
    engine.start();
    // Empty the stack directly, then step.
    engine.stack = { ...engine.stack, blocks: [] };

    let fired = 0;
    for (let i = 0; i < 120; i += 1) {
      if (engine.update(FRAME).gameOver) fired += 1;
    }
    expect(fired).toBe(1);
    expect(engine.phase).toBe('gameOver');
  });

  it('stops simulating after game over', () => {
    const engine = new GameEngine({ difficulty: 'medium', seed: 6 });
    engine.start();
    engine.stack = { ...engine.stack, blocks: [] };
    engine.update(FRAME);
    const distance = engine.distance;
    run(engine, 2);
    expect(engine.distance).toBe(distance);
  });
});

describe('frame delta handling', () => {
  /**
   * QA Plan #15. A backgrounded app hands the loop a delta of many seconds;
   * without the clamp the world advances far enough in one step to teleport
   * the stack through a wall.
   */
  it('clamps a huge delta to a single sane step', () => {
    const a = new GameEngine({ difficulty: 'medium', seed: 7 });
    const b = new GameEngine({ difficulty: 'medium', seed: 7 });
    a.start();
    b.start();

    a.update(30); // 30 seconds — a long backgrounding
    b.update(gameplay.maxFrameDelta);

    expect(a.distance).toBeCloseTo(b.distance, 5);
  });

  it('ignores zero, negative and non-finite deltas', () => {
    const engine = new GameEngine({ difficulty: 'medium', seed: 8 });
    engine.start();
    engine.update(0);
    engine.update(-5);
    engine.update(Number.NaN);
    engine.update(Number.POSITIVE_INFINITY);
    expect(engine.distance).toBe(0);
    expect(Number.isFinite(engine.stack.y)).toBe(true);
  });

  it('advances the same distance per second regardless of frame rate', () => {
    const fast = new GameEngine({ difficulty: 'medium', seed: 9 });
    const slow = new GameEngine({ difficulty: 'medium', seed: 9 });
    fast.start();
    slow.start();
    run(fast, 2, 1 / 60);
    run(slow, 2, 1 / 31);
    // Within a few percent — the speed ramp compounds slightly differently.
    expect(Math.abs(fast.distance - slow.distance) / fast.distance).toBeLessThan(0.05);
  });
});

describe('a full run', () => {
  it.each(DIFFICULTIES)('stays internally consistent on %s', (difficulty) => {
    const engine = new GameEngine({ difficulty, seed: 4242 });
    engine.start();

    // Drive the stack around so it meets obstacles rather than idling.
    for (let i = 0; i < 60 * 40; i += 1) {
      if (i % 40 === 0) {
        engine.setTargetY(
          gameplay.worldHeight * (0.25 + 0.5 * Math.abs(Math.sin(i / 90))),
        );
      }
      engine.update(FRAME);

      expect(Number.isFinite(engine.stack.y)).toBe(true);
      expect(engine.blockCount).toBeGreaterThanOrEqual(0);
      expect(engine.obstacles.length).toBeLessThanOrEqual(
        gameplay.maxActiveObstacles,
      );
      if (engine.phase === 'gameOver') break;
    }

    // The run either ended properly, or is still coherent.
    expect(['playing', 'gameOver']).toContain(engine.phase);
    expect(engine.distance).toBeGreaterThan(0);
  });

  it('never lets the stack leave the world during a long run', () => {
    const engine = new GameEngine({ difficulty: 'easy', seed: 777 });
    engine.start();
    for (let i = 0; i < 60 * 30; i += 1) {
      // Hammer the input at the bounds.
      engine.setTargetY(i % 2 === 0 ? -99999 : 99999);
      engine.update(FRAME);
      if (engine.blockCount === 0) break;
      const half = (engine.blockCount * engine.stack.blockSize) / 2;
      expect(engine.stack.y).toBeGreaterThanOrEqual(half - 0.001);
      expect(engine.stack.y).toBeLessThanOrEqual(
        gameplay.worldHeight - half + 0.001,
      );
    }
  });

  it('is reproducible from a seed', () => {
    const play = () => {
      const engine = new GameEngine({ difficulty: 'hard', seed: 31337 });
      engine.start();
      for (let i = 0; i < 60 * 15; i += 1) {
        if (i % 30 === 0) engine.setTargetY(gameplay.worldHeight * (i % 3) * 0.3);
        engine.update(FRAME);
      }
      return { d: engine.distance, b: engine.blockCount, l: engine.blocksLost };
    };
    expect(play()).toEqual(play());
  });

  it('caps the particle pool', () => {
    const engine = new GameEngine({ difficulty: 'insane', seed: 12 });
    engine.start();
    run(engine, 45);
    expect(engine.particles).toHaveLength(gameplay.maxParticles);
  });
});
