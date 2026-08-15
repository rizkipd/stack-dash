/**
 * Destruction and collection effects.
 * Owner: UI/UX (`docs/RACI.md` row 18) for feel; simulated here so the effect
 * is deterministic and stays off the React render path.
 *
 * Pooled to a fixed capacity (`docs/ARCHITECTURE.md` §9) — the pool bounds
 * worst-case frame cost, and the renderer relies on the count being stable.
 *
 * The destruction sequence follows the reference sheet's five stages:
 * **Hit → Flash → Detach → Spin Away → Fall & Fade.** A `core` particle carries
 * stages 2-5 (it *is* the block, flashing then tumbling off), while `shard`
 * particles provide the explosion.
 */

import { gameplay } from '../config/gameplay';
import type { Rng } from './Rng';
import type { Rect } from '../types';

/** 0 = debris shard, 1 = the destroyed block itself, 2 = collect sparkle. */
export const PARTICLE_SHARD = 0;
export const PARTICLE_CORE = 1;
export const PARTICLE_STAR = 2;

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  /** Seconds remaining. <= 0 means the slot is free. */
  life: number;
  maxLife: number;
  /** Rotation in radians, carried so shards tumble rather than slide. */
  rotation: number;
  spin: number;
  kind: number;
  active: boolean;
};

const GRAVITY = 2600;
const SHARDS_PER_BLOCK = 7;
const STARS_PER_COLLECT = 8;

export function createParticlePool(): Particle[] {
  return Array.from({ length: gameplay.maxParticles }, () => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    size: 0,
    life: 0,
    maxLife: 1,
    rotation: 0,
    spin: 0,
    kind: PARTICLE_SHARD,
    active: false,
  }));
}

/** Claims a free slot, or returns null when the pool is saturated. */
function claim(pool: Particle[]): Particle | null {
  for (let i = 0; i < pool.length; i += 1) {
    if (!pool[i]!.active) return pool[i]!;
  }
  return null;
}

/**
 * Bursts a destroyed block: one tumbling core plus a spray of shards.
 *
 * Mutates the pool in place — allocating a fresh array 60 times a second is
 * exactly the garbage the frame budget cannot afford.
 */
export function burst(pool: Particle[], rect: Rect, rng: Rng): void {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;

  // Stage 2-5: the block detaches and spins away.
  const core = claim(pool);
  if (core) {
    core.x = cx;
    core.y = cy;
    core.vx = rng.nextRange(-90, 190);
    core.vy = rng.nextRange(-620, -280);
    core.size = rect.width;
    core.maxLife = rng.nextRange(0.55, 0.8);
    core.life = core.maxLife;
    core.rotation = 0;
    core.spin = rng.nextRange(-9, 9);
    core.kind = PARTICLE_CORE;
    core.active = true;
  }

  for (let i = 0; i < SHARDS_PER_BLOCK; i += 1) {
    const p = claim(pool);
    if (!p) return;

    const angle = rng.nextRange(0, Math.PI * 2);
    const speed = rng.nextRange(160, 620);

    p.x = cx + rng.nextRange(-rect.width / 3, rect.width / 3);
    p.y = cy + rng.nextRange(-rect.height / 3, rect.height / 3);
    p.vx = Math.cos(angle) * speed;
    // Bias upward so the burst reads as an explosion, not a drip.
    p.vy = Math.sin(angle) * speed - rng.nextRange(120, 380);
    p.size = rng.nextRange(rect.width * 0.14, rect.width * 0.34);
    p.maxLife = rng.nextRange(0.32, 0.62);
    p.life = p.maxLife;
    p.rotation = rng.nextRange(0, Math.PI * 2);
    p.spin = rng.nextRange(-14, 14);
    p.kind = PARTICLE_SHARD;
    p.active = true;
  }
}

/** Sparkle ring when a `+1` is collected. */
export function sparkle(
  pool: Particle[],
  x: number,
  y: number,
  size: number,
  rng: Rng,
): void {
  for (let i = 0; i < STARS_PER_COLLECT; i += 1) {
    const p = claim(pool);
    if (!p) return;

    const angle = (i / STARS_PER_COLLECT) * Math.PI * 2 + rng.nextRange(-0.3, 0.3);
    const speed = rng.nextRange(180, 380);

    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.size = size * rng.nextRange(0.12, 0.24);
    p.maxLife = rng.nextRange(0.3, 0.5);
    p.life = p.maxLife;
    p.rotation = angle;
    p.spin = rng.nextRange(-6, 6);
    p.kind = PARTICLE_STAR;
    p.active = true;
  }
}

/** Advances the pool. `scrollX` moves particles with the world as it scrolls. */
export function updateParticles(
  pool: Particle[],
  dt: number,
  scrollX: number,
): void {
  for (let i = 0; i < pool.length; i += 1) {
    const p = pool[i]!;
    if (!p.active) continue;

    p.life -= dt;
    if (p.life <= 0) {
      p.active = false;
      continue;
    }

    // Sparkles float; debris falls.
    if (p.kind === PARTICLE_STAR) {
      p.vx *= 1 - Math.min(1, 3.2 * dt);
      p.vy *= 1 - Math.min(1, 3.2 * dt);
    } else {
      p.vy += GRAVITY * dt;
    }

    p.x += p.vx * dt - scrollX;
    p.y += p.vy * dt;
    p.rotation += p.spin * dt;
  }
}

export function clearParticles(pool: Particle[]): void {
  for (let i = 0; i < pool.length; i += 1) {
    pool[i]!.active = false;
    pool[i]!.life = 0;
  }
}
