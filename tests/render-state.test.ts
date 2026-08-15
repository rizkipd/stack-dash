import { GameEngine } from '../src/game/engine/GameEngine';
import { gameplay } from '../src/game/config/gameplay';
import {
  BLOCK_STRIDE,
  OBSTACLE_STRIDE,
  buildRenderState,
} from '../src/game/render/renderState';

const FRAME = 1 / 60;

function engineAt(seconds: number, difficulty: 'easy' | 'insane' = 'easy') {
  const engine = new GameEngine({ difficulty, seed: 4242 });
  engine.start();
  for (let i = 0; i < Math.round(seconds / FRAME); i += 1) engine.update(FRAME);
  return engine;
}

describe('render state', () => {
  /**
   * Regression: the render state used to be built into one reused scratch
   * buffer. Reanimated freezes objects written to a shared value, so the next
   * frame's mutation threw and killed the game loop — the game rendered frame
   * one and then sat perfectly still.
   */
  it('returns a fresh object on every call', () => {
    const engine = engineAt(1);
    const a = buildRenderState(engine, 1, 0, 0);
    const b = buildRenderState(engine, 1, 0, 0);

    expect(a).not.toBe(b);
    expect(a.blocks).not.toBe(b.blocks);
    expect(a.obstacles).not.toBe(b.obstacles);
    expect(a.collectibles).not.toBe(b.collectibles);
    expect(a.particles).not.toBe(b.particles);
  });

  it('still builds correctly after a previous result is frozen', () => {
    const engine = engineAt(1);

    // Exactly what Reanimated does to a value assigned to a shared value.
    const first = buildRenderState(engine, 1, 0, 0);
    Object.freeze(first);
    Object.freeze(first.blocks);

    engine.update(FRAME);
    expect(() => buildRenderState(engine, 1, 0, 0)).not.toThrow();
  });

  it('keeps advancing across many frames', () => {
    const engine = engineAt(0.5);
    const seen: number[] = [];
    for (let i = 0; i < 120; i += 1) {
      engine.update(FRAME);
      const state = buildRenderState(engine, 1, 0, 0);
      Object.freeze(state);
      seen.push(state.distance);
    }
    // Strictly increasing distance proves the loop never stalled.
    for (let i = 1; i < seen.length; i += 1) {
      expect(seen[i]!).toBeGreaterThan(seen[i - 1]!);
    }
  });

  it('packs one entry per block, with the configured stride', () => {
    const engine = engineAt(0.2);
    const state = buildRenderState(engine, 1, 0, 0);
    expect(state.blocks.length).toBe(engine.blockCount * BLOCK_STRIDE);
    expect(state.blocks.length % BLOCK_STRIDE).toBe(0);
  });

  it('packs obstacle rects in world space', () => {
    const engine = engineAt(4);
    const state = buildRenderState(engine, 1, 0, 0);
    expect(state.obstacles.length % OBSTACLE_STRIDE).toBe(0);
    expect(state.obstacles.length).toBeGreaterThan(0);
    for (let i = 0; i < state.obstacles.length; i += OBSTACLE_STRIDE) {
      expect(Number.isFinite(state.obstacles[i]!)).toBe(true);
      expect(state.obstacles[i + 2]!).toBeGreaterThan(0);
    }
  });

  it('applies scale and offset to screen mapping inputs', () => {
    const engine = engineAt(0.2);
    const plain = buildRenderState(engine, 1, 0, 0);
    const scaled = buildRenderState(engine, 2, 0, 0);
    // Geometry is applied at draw time; the packed values stay in world units.
    expect(scaled.scale).toBe(2);
    expect(plain.scale).toBe(1);
    expect(scaled.blocks[0]).toBeCloseTo(plain.blocks[0]!);
  });

  it('advances cube rotation over time', () => {
    const early = buildRenderState(engineAt(0.2), 1, 0, 0);
    const later = buildRenderState(engineAt(2.0), 1, 0, 0);
    // Index 4 is rotY.
    expect(later.blocks[4]).not.toBeCloseTo(early.blocks[4]!);
  });

  it('gives each block a distinct rotation phase', () => {
    const state = buildRenderState(engineAt(1), 1, 0, 0);
    const first = state.blocks[4]!;
    const second = state.blocks[BLOCK_STRIDE + 4]!;
    expect(first).not.toBeCloseTo(second);
  });

  it('spins faster on insane than on easy', () => {
    const easy = buildRenderState(engineAt(1, 'easy'), 1, 0, 0);
    const insane = buildRenderState(engineAt(1, 'insane'), 1, 0, 0);
    expect(Math.abs(insane.blocks[4]!)).toBeGreaterThan(Math.abs(easy.blocks[4]!));
  });

  it('emits only finite numbers', () => {
    const state = buildRenderState(engineAt(6, 'insane'), 0.5, 12, 0);
    for (const key of ['blocks', 'obstacles', 'collectibles', 'particles'] as const) {
      for (const value of state[key]) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
    expect(Number.isFinite(state.lean)).toBe(true);
    expect(Number.isFinite(state.shake)).toBe(true);
  });

  it('reports a bounded lean and trail', () => {
    const engine = new GameEngine({ difficulty: 'insane', seed: 8 });
    engine.start();
    for (let i = 0; i < 400; i += 1) {
      engine.setTargetY(i % 2 === 0 ? 0 : gameplay.worldHeight);
      engine.update(FRAME);
      const state = buildRenderState(engine, 1, 0, 0);
      expect(state.lean).toBeGreaterThanOrEqual(-1);
      expect(state.lean).toBeLessThanOrEqual(1);
      expect(state.trail).toBeGreaterThanOrEqual(0);
      expect(state.trail).toBeLessThanOrEqual(1);
    }
  });
});
