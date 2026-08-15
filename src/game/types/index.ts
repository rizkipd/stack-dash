/**
 * Core simulation types.
 *
 * This module — and everything under `src/game/` — imports **no React**.
 * That is CLAUDE.md Architecture Rule 1, and it is what makes `tests/`
 * runnable without a renderer.
 */

export type Difficulty = 'easy' | 'medium' | 'hard' | 'insane';

export const DIFFICULTIES: readonly Difficulty[] = [
  'easy',
  'medium',
  'hard',
  'insane',
] as const;

/** `docs/GAME_DESIGN.md` §10. */
export type GamePhase =
  | 'boot'
  | 'menu'
  | 'difficultySelect'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'gameOver';

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Block = {
  id: string;
  /** Position within the stack, 0 = bottom. */
  localIndex: number;
  active: boolean;
};

export type PlayerStack = {
  x: number;
  y: number;
  blockSize: number;
  blocks: Block[];
  verticalVelocity: number;
};

/** MVP pattern families, `docs/GAME_DESIGN.md` §6. */
export type ObstaclePatternType =
  | 'bottomWall'
  | 'topWall'
  | 'centerWall'
  | 'gate'
  | 'staggered'
  | 'doubleWall';

export type Obstacle = {
  id: string;
  x: number;
  rects: Rect[];
  patternType: ObstaclePatternType;
  passed: boolean;
};

export type Collectible = {
  id: string;
  x: number;
  y: number;
  size: number;
  collected: boolean;
};

/**
 * Immutable-by-convention snapshot published to the renderer once per frame.
 * Rendering reads this; it never defines game rules.
 */
export type GameSnapshot = {
  phase: GamePhase;
  difficulty: Difficulty;
  stack: PlayerStack;
  obstacles: Obstacle[];
  collectibles: Collectible[];
  distance: number;
  blockCount: number;
  speed: number;
};
