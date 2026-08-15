import {
  canTransition,
  countActiveBlocks,
  createGameState,
  createStack,
  resetGameState,
  toSnapshot,
  transition,
} from '../src/game/engine/GameState';
import { DIFFICULTY_CONFIG } from '../src/game/config/difficulty';
import { DIFFICULTIES } from '../src/game/types';

describe('stack construction', () => {
  // QA Plan test #1.
  it.each(DIFFICULTIES)('starts %s with its configured block count', (difficulty) => {
    const stack = createStack(difficulty);
    expect(stack.blocks).toHaveLength(DIFFICULTY_CONFIG[difficulty].startingBlocks);
    expect(stack.blocks.every((b) => b.active)).toBe(true);
  });

  it('gives every block a unique id', () => {
    const stack = createStack('easy');
    expect(new Set(stack.blocks.map((b) => b.id)).size).toBe(stack.blocks.length);
  });

  it('indexes blocks contiguously from the bottom', () => {
    const stack = createStack('medium');
    // Derived, not hardcoded: starting counts are tunable balance data and a
    // test that pins them fails on every legitimate rebalance.
    expect(stack.blocks.map((b) => b.localIndex)).toEqual(
      Array.from({ length: DIFFICULTY_CONFIG.medium.startingBlocks }, (_, i) => i),
    );
  });
});

describe('game state', () => {
  it('begins in the ready phase with a zeroed score', () => {
    const state = createGameState('medium');
    expect(state.phase).toBe('ready');
    expect(state.distance).toBe(0);
    expect(state.obstacles).toHaveLength(0);
    expect(state.collectibles).toHaveLength(0);
    expect(state.gameOverEmitted).toBe(false);
  });

  it('scales speed by the difficulty multiplier', () => {
    const easy = createGameState('easy');
    const insane = createGameState('insane');
    expect(insane.speed).toBeGreaterThan(easy.speed);
  });

  // QA Plan test #10 — Retry must fully reset the run.
  it('resets score, obstacles and collectibles on retry', () => {
    const state = createGameState('hard');
    state.distance = 1234;
    state.obstacles.push({
      id: 'o1',
      x: 500,
      rects: [],
      patternType: 'bottomWall',
      passed: false,
    });
    state.collectibles.push({ id: 'c1', x: 600, y: 300, size: 40, collected: false });

    const fresh = resetGameState(state);

    expect(fresh.distance).toBe(0);
    expect(fresh.obstacles).toHaveLength(0);
    expect(fresh.collectibles).toHaveLength(0);
    expect(fresh.gameOverEmitted).toBe(false);
    // Retry keeps the selected difficulty (docs/GAME_DESIGN.md §10).
    expect(fresh.difficulty).toBe('hard');
    expect(fresh.stack.blocks).toHaveLength(
      DIFFICULTY_CONFIG.hard.startingBlocks,
    );
  });

  it('counts only active blocks', () => {
    const state = createGameState('easy');
    const total = DIFFICULTY_CONFIG.easy.startingBlocks;
    expect(countActiveBlocks(state)).toBe(total);
    state.stack.blocks[0]!.active = false;
    state.stack.blocks[1]!.active = false;
    expect(countActiveBlocks(state)).toBe(total - 2);
  });
});

describe('phase machine', () => {
  it('allows the documented lifecycle path', () => {
    expect(canTransition('boot', 'menu')).toBe(true);
    expect(canTransition('menu', 'difficultySelect')).toBe(true);
    expect(canTransition('difficultySelect', 'ready')).toBe(true);
    expect(canTransition('ready', 'playing')).toBe(true);
    expect(canTransition('playing', 'paused')).toBe(true);
    expect(canTransition('paused', 'playing')).toBe(true);
    expect(canTransition('playing', 'gameOver')).toBe(true);
    expect(canTransition('gameOver', 'ready')).toBe(true);
  });

  it('rejects transitions that skip the lifecycle', () => {
    expect(canTransition('menu', 'playing')).toBe(false);
    expect(canTransition('gameOver', 'playing')).toBe(false);
    // Game Over is terminal for a run; it cannot re-enter pause.
    expect(canTransition('gameOver', 'paused')).toBe(false);
  });

  it('throws rather than silently entering an invalid phase', () => {
    const state = createGameState('medium');
    expect(() => transition(state, 'gameOver')).toThrow(/Invalid phase transition/);
  });

  it('does not mutate the source state on transition', () => {
    const state = createGameState('medium');
    const next = transition(state, 'playing');
    expect(state.phase).toBe('ready');
    expect(next.phase).toBe('playing');
  });
});

describe('snapshot', () => {
  it('reports the live active block count', () => {
    const state = createGameState('hard');
    state.stack.blocks[0]!.active = false;
    const snapshot = toSnapshot(state);
    expect(snapshot.blockCount).toBe(DIFFICULTY_CONFIG.hard.startingBlocks - 1);
    expect(snapshot.difficulty).toBe('hard');
  });
});
