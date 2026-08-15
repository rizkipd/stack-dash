/**
 * The bridge between simulation and renderer.
 *
 * Rendering reads this; it never defines game rules (CLAUDE.md Rule 4).
 *
 * Everything is packed into flat number arrays. That is deliberate: this object
 * is written to a Reanimated shared value every frame and read on the UI
 * thread, and flat numeric arrays cross that boundary far more cheaply than a
 * graph of objects.
 *
 * The 3D rotation, the trailing "whip" and the lean are computed here rather
 * than in the drawing worklet, so the worklet stays a dumb consumer and the
 * maths stays testable.
 */

import { getDifficultyConfig } from '../config/difficulty';
import { gameplay } from '../config/gameplay';
import { blockRect } from '../entities/PlayerStack';
import { obstacleRects } from '../systems/CollisionSystem';
import type { GameEngine } from '../engine/GameEngine';

/** Floats per entity in each packed array. */
export const BLOCK_STRIDE = 7; // x, y, size, rotX, rotY, rotZ, trail
export const OBSTACLE_STRIDE = 4; // x, y, width, height
export const COLLECTIBLE_STRIDE = 4; // x, y, size, pulse
export const PARTICLE_STRIDE = 6; // x, y, size, rotation, alpha, kind

export type RenderState = {
  blocks: number[];
  obstacles: number[];
  collectibles: number[];
  particles: number[];
  /** World → screen scale. */
  scale: number;
  offsetX: number;
  offsetY: number;
  /** Normalised −1..1 vertical velocity, drives the stack lean. */
  lean: number;
  elapsed: number;
  /** World distance travelled, drives parallax. */
  distance: number;
  /** 0..1 speed-trail intensity, rises as the run accelerates. */
  trail: number;
  /** Decaying 0..1 screen-shake impulse. */
  shake: number;
};

export function createRenderState(): RenderState {
  return {
    blocks: [],
    obstacles: [],
    collectibles: [],
    particles: [],
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    lean: 0,
    elapsed: 0,
    distance: 0,
    trail: 0,
    shake: 0,
  };
}

const TAU = Math.PI * 2;

/** Seconds of trail between the bottom block and the top of the stack. */
const WHIP_SECONDS = 0.05;
/** How far, in block widths, the top of the stack sways behind a fast move. */
const SWAY_STRENGTH = 0.2;
const MAX_LEAN = 0.3; // radians

/**
 * Phase offset between adjacent cubes, in revolutions.
 *
 * "Each block has a tiny phase difference" — without it the stack spins as one
 * rigid object and reads as a single sprite rather than a stack of cubes.
 */
const PHASE_PER_BLOCK = 0.085;

/** X-axis spin relative to Y, so the tumble is not a flat carousel. */
const X_AXIS_RATIO = 0.55;

/**
 * Packs the engine's current state for the renderer.
 *
 * **Returns a fresh object every frame, deliberately.** Reanimated freezes
 * objects written to a shared value, so reusing one scratch buffer and
 * reassigning the same reference throws on the next frame's mutation and kills
 * the game loop. A new object with new arrays each frame is a few hundred
 * numbers of garbage — cheap, and the only correct option.
 */
export function buildRenderState(
  engine: GameEngine,
  scale: number,
  offsetX: number,
  offsetY: number,
): RenderState {
  const out = createRenderState();
  out.scale = scale;
  out.offsetX = offsetX;
  out.offsetY = offsetY;
  out.elapsed = engine.elapsed;
  out.distance = engine.distance;
  out.shake = engine.shake;

  const velocity = engine.stack.verticalVelocity;
  const normalised = Math.max(
    -1,
    Math.min(1, velocity / gameplay.maxVerticalSpeed),
  );
  out.lean = normalised;

  const config = getDifficultyConfig(engine.difficulty);

  // Rotation accelerates with the run, matching the reference sheet's
  // SPEED VS ROTATION panel: spin is how speed is *felt*.
  const baseSpeed = gameplay.baseSpeed * config.speedMultiplier;
  const speedRatio = baseSpeed > 0 ? engine.speed / baseSpeed : 1;
  const spin = config.rotationSpeed * speedRatio;
  out.trail = Math.max(0, Math.min(1, (speedRatio - 1) / 0.6));

  // --- Blocks ---
  const blocks = engine.stack.blocks;
  const count = blocks.length;
  const size = engine.stack.blockSize;

  for (let i = 0; i < count; i += 1) {
    const rect = blockRect(engine.stack, i);
    // 0 at the bottom of the stack, 1 at the top: the higher a block sits, the
    // more it trails the move, which is what sells the stack as one object with
    // mass rather than a rigid bar.
    const factor = count > 1 ? i / (count - 1) : 0;

    const trailY = -velocity * WHIP_SECONDS * factor;
    const swayX = -normalised * SWAY_STRENGTH * size * factor;
    const lean = -normalised * MAX_LEAN * factor;

    // Idle bob, so the stack breathes even when the player is still.
    const bob = Math.sin(engine.elapsed * 2.2 + i * 0.55) * size * 0.025;

    const angle = (engine.elapsed * spin + i * PHASE_PER_BLOCK) * TAU;

    const o = i * BLOCK_STRIDE;
    out.blocks[o] = rect.x + swayX;
    out.blocks[o + 1] = rect.y + trailY + bob;
    out.blocks[o + 2] = size;
    out.blocks[o + 3] = angle * X_AXIS_RATIO;
    out.blocks[o + 4] = angle;
    out.blocks[o + 5] = lean;
    out.blocks[o + 6] = out.trail;
  }

  // --- Obstacles ---
  let oi = 0;
  for (const obstacle of engine.obstacles) {
    for (const rect of obstacleRects(obstacle)) {
      out.obstacles[oi] = rect.x;
      out.obstacles[oi + 1] = rect.y;
      out.obstacles[oi + 2] = rect.width;
      out.obstacles[oi + 3] = rect.height;
      oi += OBSTACLE_STRIDE;
    }
  }

  // --- Collectibles ---
  let ci = 0;
  for (const item of engine.collectibles) {
    if (item.collected) continue;
    out.collectibles[ci] = item.x;
    out.collectibles[ci + 1] = item.y;
    out.collectibles[ci + 2] = item.size;
    // Idle breathing pulse, ~1.2s cycle (docs/ART_DIRECTION.md §6).
    out.collectibles[ci + 3] =
      0.5 + 0.5 * Math.sin((engine.elapsed * TAU) / 1.2);
    ci += COLLECTIBLE_STRIDE;
  }

  // --- Particles ---
  let pi = 0;
  for (const particle of engine.particles) {
    if (!particle.active) continue;
    out.particles[pi] = particle.x;
    out.particles[pi + 1] = particle.y;
    out.particles[pi + 2] = particle.size;
    out.particles[pi + 3] = particle.rotation;
    out.particles[pi + 4] = Math.max(0, particle.life / particle.maxLife);
    out.particles[pi + 5] = particle.kind;
    pi += PARTICLE_STRIDE;
  }

  return out;
}
