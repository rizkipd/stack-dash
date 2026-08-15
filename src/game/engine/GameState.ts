/**
 * Game state container and lifecycle transitions.
 *
 * M0 scope: state shape and phase machine only. Movement, collision, spawning
 * and scoring arrive in M1-M3 and are owned per `docs/RACI.md`.
 */

import { gameplay } from '../config/gameplay';
import { getDifficultyConfig } from '../config/difficulty';
import type {
  Block,
  Collectible,
  Difficulty,
  GamePhase,
  GameSnapshot,
  Obstacle,
  PlayerStack,
} from '../types';

export type GameState = {
  phase: GamePhase;
  difficulty: Difficulty;
  stack: PlayerStack;
  obstacles: Obstacle[];
  collectibles: Collectible[];
  distance: number;
  elapsed: number;
  speed: number;
  /** Guards the 1 → 0 blocks transition so Game Over fires exactly once. */
  gameOverEmitted: boolean;
};

let blockIdCounter = 0;

/** Ids come from a counter, never Math.random, so runs stay reproducible. */
function createBlock(localIndex: number): Block {
  blockIdCounter += 1;
  return { id: `block-${blockIdCounter}`, localIndex, active: true };
}

export function createStack(difficulty: Difficulty): PlayerStack {
  const { startingBlocks } = getDifficultyConfig(difficulty);
  return {
    x: gameplay.playerX,
    y: gameplay.worldHeight / 2,
    blockSize: gameplay.blockSize,
    blocks: Array.from({ length: startingBlocks }, (_, i) => createBlock(i)),
    verticalVelocity: 0,
  };
}

export function createGameState(difficulty: Difficulty): GameState {
  const config = getDifficultyConfig(difficulty);
  return {
    phase: 'ready',
    difficulty,
    stack: createStack(difficulty),
    obstacles: [],
    collectibles: [],
    distance: 0,
    elapsed: 0,
    speed: gameplay.baseSpeed * config.speedMultiplier,
    gameOverEmitted: false,
  };
}

/** Full reset. Retry must clear score, stack, obstacles and collectibles. */
export function resetGameState(state: GameState, difficulty?: Difficulty): GameState {
  return createGameState(difficulty ?? state.difficulty);
}

export function countActiveBlocks(state: GameState): number {
  return state.stack.blocks.filter((b) => b.active).length;
}

const VALID_TRANSITIONS: Record<GamePhase, readonly GamePhase[]> = {
  boot: ['menu'],
  menu: ['difficultySelect'],
  difficultySelect: ['ready', 'menu'],
  ready: ['playing', 'menu'],
  playing: ['paused', 'gameOver'],
  paused: ['playing', 'ready', 'menu'],
  gameOver: ['ready', 'menu'],
};

export function canTransition(from: GamePhase, to: GamePhase): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function transition(state: GameState, to: GamePhase): GameState {
  if (!canTransition(state.phase, to)) {
    throw new Error(`Invalid phase transition: ${state.phase} → ${to}`);
  }
  return { ...state, phase: to };
}

export function toSnapshot(state: GameState): GameSnapshot {
  return {
    phase: state.phase,
    difficulty: state.difficulty,
    stack: state.stack,
    obstacles: state.obstacles,
    collectibles: state.collectibles,
    distance: state.distance,
    blockCount: countActiveBlocks(state),
    speed: state.speed,
  };
}
