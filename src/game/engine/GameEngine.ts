/**
 * The simulation.
 *
 * Owner: Gameplay Programmer (`docs/RACI.md` row 7).
 *
 * **Imports no React.** State lives in plain mutable structures held by the
 * engine instance; the React layer holds one ref to it and reads snapshots.
 * This is CLAUDE.md Architecture Rule 1 and what makes `tests/` runnable
 * without a renderer.
 *
 * Frame order follows `docs/ARCHITECTURE.md` §7.
 */

import { getDifficultyConfig } from '../config/difficulty';
import { gameplay } from '../config/gameplay';
import {
  addBlock,
  clampStackY,
  createBlock,
  removeBlocks,
  stackHeight,
} from '../entities/PlayerStack';
import {
  detectCollections,
  detectCollisions,
  obstacleRects,
} from '../systems/CollisionSystem';
import {
  COLLECTIBLE_SIZE,
  collect,
  maybeSpawnCollectible,
} from '../systems/CollectibleSystem';
import { currentSpeed } from '../systems/DifficultyManager';
import { advanceDistance, updateStackPosition } from '../systems/MovementSystem';
import { generateObstacle, nextSpawnGap } from '../systems/ObstacleGenerator';
import { accumulateDistance, clampDelta, distanceToScore } from '../systems/ScoreManager';
import {
  burst,
  clearParticles,
  createParticlePool,
  sparkle,
  updateParticles,
  type Particle,
} from './Particles';
import { createRng, createSeed, type Rng } from './Rng';
import type {
  Collectible,
  Difficulty,
  GamePhase,
  Obstacle,
  PlayerStack,
} from '../types';

/** Events the presentation layer reacts to — sound, haptics, HUD flashes. */
export type FrameEvents = {
  blocksLost: number;
  blocksGained: number;
  gameOver: boolean;
};

const NO_EVENTS: FrameEvents = { blocksLost: 0, blocksGained: 0, gameOver: false };

export type EngineOptions = {
  difficulty: Difficulty;
  /** Fixed seed for tests; omit for an ordinary run. */
  seed?: number;
};

export class GameEngine {
  phase: GamePhase = 'ready';
  difficulty: Difficulty;
  stack: PlayerStack;
  obstacles: Obstacle[] = [];
  collectibles: Collectible[] = [];
  particles: Particle[] = createParticlePool();

  distance = 0;
  elapsed = 0;
  speed: number;
  targetY: number;

  blocksLost = 0;
  blocksGained = 0;

  /**
   * Decaying 0..1 screen-shake impulse, read by the renderer.
   *
   * Kept deliberately small: `docs/GAME_DESIGN.md` §11 rules out shake heavy
   * enough to obscure an approaching obstacle.
   */
  shake = 0;

  readonly seed: number;
  private rng: Rng;

  /** World x at which the next obstacle spawns. */
  private nextSpawnX: number;
  private previousOpenings: { start: number; end: number }[] | undefined;
  private previousRightEdge: number | undefined;

  /** Ensures the 1 → 0 transition emits Game Over exactly once (QA Plan #9). */
  private gameOverEmitted = false;

  constructor(options: EngineOptions) {
    this.difficulty = options.difficulty;
    this.seed = options.seed ?? createSeed();
    this.rng = createRng(this.seed);

    const config = getDifficultyConfig(options.difficulty);
    this.stack = {
      x: gameplay.playerX,
      y: gameplay.worldHeight / 2,
      blockSize: gameplay.blockSize,
      blocks: Array.from({ length: config.startingBlocks }, (_, i) => createBlock(i)),
      verticalVelocity: 0,
    };
    this.targetY = this.stack.y;
    this.speed = currentSpeed(options.difficulty, 0);
    this.nextSpawnX = gameplay.playerX + gameplay.spawnAheadDistance;
  }

  get blockCount(): number {
    return this.stack.blocks.length;
  }

  get score(): number {
    return distanceToScore(this.distance);
  }

  /** Player input. Absolute target in world coordinates. */
  setTargetY(y: number): void {
    this.targetY = clampStackY(this.stack, y);
  }

  start(): void {
    if (this.phase === 'ready' || this.phase === 'paused') this.phase = 'playing';
  }

  pause(): void {
    if (this.phase === 'playing') this.phase = 'paused';
  }

  resume(): void {
    if (this.phase === 'paused') this.phase = 'playing';
  }

  /** Full reset. Retry must clear everything (QA Plan #10). */
  reset(difficulty: Difficulty = this.difficulty, seed?: number): void {
    const config = getDifficultyConfig(difficulty);
    this.phase = 'ready';
    this.difficulty = difficulty;
    this.rng = createRng(seed ?? createSeed());
    this.stack = {
      x: gameplay.playerX,
      y: gameplay.worldHeight / 2,
      blockSize: gameplay.blockSize,
      blocks: Array.from({ length: config.startingBlocks }, (_, i) => createBlock(i)),
      verticalVelocity: 0,
    };
    this.targetY = this.stack.y;
    this.obstacles = [];
    this.collectibles = [];
    clearParticles(this.particles);
    this.distance = 0;
    this.elapsed = 0;
    this.speed = currentSpeed(difficulty, 0);
    this.blocksLost = 0;
    this.blocksGained = 0;
    this.shake = 0;
    this.nextSpawnX = gameplay.playerX + gameplay.spawnAheadDistance;
    this.previousOpenings = undefined;
    this.previousRightEdge = undefined;
    this.gameOverEmitted = false;
  }

  /**
   * Advances one frame.
   *
   * `rawDt` is clamped before anything else uses it — every downstream system
   * assumes a sane delta.
   */
  update(rawDt: number): FrameEvents {
    const dt = clampDelta(rawDt);

    // Particles keep animating on the Game Over screen, so they run even when
    // the simulation itself is stopped.
    if (this.phase !== 'playing') {
      if (dt > 0) updateParticles(this.particles, dt, 0);
      return NO_EVENTS;
    }
    if (dt === 0) return NO_EVENTS;

    this.elapsed += dt;
    // Shake decays fast — it punctuates a hit, it does not linger over one.
    this.shake = Math.max(0, this.shake - dt * 3.2);

    // 1. Difficulty
    this.speed = currentSpeed(this.difficulty, this.distance);

    // 2. Player Y
    this.stack = updateStackPosition(this.stack, this.targetY, dt);

    // 3. Advance the world
    const scrollX = advanceDistance(this.speed, dt);
    for (const obstacle of this.obstacles) obstacle.x -= scrollX;
    for (const item of this.collectibles) item.x -= scrollX;
    this.nextSpawnX -= scrollX;
    if (this.previousRightEdge !== undefined) this.previousRightEdge -= scrollX;

    // 4. Spawn
    this.spawnIfNeeded();

    // 5. Collision — detect against an unmutated stack, then apply.
    let blocksLost = 0;
    const { hitIndices, hitRects } = detectCollisions(this.stack, this.obstacles);
    if (hitIndices.length > 0) {
      for (const rect of hitRects) burst(this.particles, rect, this.rng);
      this.stack = removeBlocks(this.stack, hitIndices);
      blocksLost = hitIndices.length;
      this.blocksLost += blocksLost;
      this.targetY = clampStackY(this.stack, this.targetY);
      // Impulse scales with the size of the hit but stays capped.
      this.shake = Math.min(1, this.shake + 0.35 + blocksLost * 0.12);
    }

    // 6. Collectibles
    let blocksGained = 0;
    const touched = detectCollections(this.stack, this.collectibles);
    if (touched.length > 0) {
      const { collectibles, gained } = collect(this.collectibles, touched);
      this.collectibles = collectibles;
      for (const item of touched) {
        sparkle(this.particles, item.x, item.y, item.size, this.rng);
      }
      for (let i = 0; i < gained; i += 1) this.stack = addBlock(this.stack);
      blocksGained = gained;
      this.blocksGained += gained;
      this.targetY = clampStackY(this.stack, this.targetY);
    }

    // 7. Score
    this.distance = accumulateDistance(this.distance, this.speed, dt);

    // 8. Particles
    updateParticles(this.particles, dt, scrollX);

    // 9. Despawn
    this.despawn();

    // 10. Game over — exactly once.
    let gameOver = false;
    if (this.stack.blocks.length === 0 && !this.gameOverEmitted) {
      this.gameOverEmitted = true;
      this.phase = 'gameOver';
      gameOver = true;
    }

    return blocksLost || blocksGained || gameOver
      ? { blocksLost, blocksGained, gameOver }
      : NO_EVENTS;
  }

  private spawnIfNeeded(): void {
    if (this.obstacles.length >= gameplay.maxActiveObstacles) return;
    if (this.nextSpawnX > gameplay.playerX + gameplay.spawnAheadDistance) return;

    const height = stackHeight(this.stack);
    const spawnX = gameplay.playerX + gameplay.spawnAheadDistance;

    const result = generateObstacle({
      difficulty: this.difficulty,
      rng: this.rng,
      speed: this.speed,
      distance: this.distance,
      stackHeight: height,
      playerY: this.stack.y,
      spawnX,
      previousOpenings: this.previousOpenings,
      previousRightEdge: this.previousRightEdge,
    });

    this.obstacles.push(result.obstacle);
    this.previousOpenings = result.openings;
    this.previousRightEdge = result.rightEdge;

    const item = maybeSpawnCollectible(
      this.difficulty,
      this.rng,
      result.openings,
      // Sit the item past the wall so it rewards a clean pass.
      result.rightEdge + COLLECTIBLE_SIZE * 2,
      height,
    );
    if (item) this.collectibles.push(item);

    // Measure the next spawn from this obstacle's RIGHT EDGE, not its left.
    //
    // Patterns are not all one wall wide: `staggered` spans 396 world units.
    // Spacing from the left edge meant that once the distance ramp tightened
    // the gap below the pattern's own width, the next obstacle spawned *inside*
    // the previous one. Two individually-passable patterns then overlapped into
    // a solid barrier — each is legal alone, so per-pattern validation could
    // never catch it. `scripts/audit-fairness.mjs` scans the composed world for
    // exactly this.
    this.nextSpawnX =
      result.rightEdge + nextSpawnGap(this.difficulty, this.distance);
  }

  private despawn(): void {
    const cutoff = gameplay.playerX - gameplay.despawnBehindDistance;

    this.obstacles = this.obstacles.filter((obstacle) => {
      const right = obstacleRects(obstacle).reduce(
        (max, r) => Math.max(max, r.x + r.width),
        obstacle.x,
      );
      return right > cutoff;
    });

    this.collectibles = this.collectibles.filter(
      (item) => !item.collected && item.x + item.size > cutoff,
    );
  }
}
