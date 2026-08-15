/**
 * Destruction, impact and collection effects.
 *
 * Owner: Game Designer (`docs/RACI.md` row 5, game feel / juice spec).
 * Simulated here rather than in the renderer so the effect is deterministic,
 * testable, and stays off the React render path.
 *
 * Pooled to a fixed capacity (`docs/ARCHITECTURE.md` §9) — the pool bounds
 * worst-case frame cost, and the renderer relies on the count being stable.
 *
 * ## What this emits, and why
 *
 * Transcribed from the EFFECTS & PARTICLES panel of `image copy 2.png`. The
 * sheet does not draw one generic "puff"; it draws five distinguishable
 * effects, and each carries different information to the player:
 *
 * | Sheet swatch   | Kind             | What it tells the player          |
 * |----------------|------------------|-----------------------------------|
 * | Hit Explosion  | `FLASH`+`SHARD`  | *something just went wrong, here* |
 * | Block Destroy  | `CHUNK`+`CORE`   | *and it cost you a block*         |
 * | Star Particles | `STAR`           | *that was good*                   |
 * | Collect Glow   | `RING`           | *and it was a pickup, not a hit*  |
 *
 * The split matters. The flash is the *alarm* — loud, instantaneous, over
 * before the next obstacle needs reading. The blue chunks are the *receipt* —
 * quieter, slower, and painted in the player's own colour, because their job is
 * to say which of your blocks you just lost. Collapsing the two into one red
 * puff was the main reason the old burst read as noise rather than as loss.
 *
 * The destroyed block still follows the sheet's five stages —
 * **Hit → Flash → Detach → Spin Away → Fall & Fade** — carried by the `CORE`
 * particle, which *is* the block: it flashes white, detaches, tumbles, shrinks
 * as it recedes and fades out.
 *
 * ## Constraints this code is written against
 *
 * - `docs/GAME_DESIGN.md` §11: **no effect may obscure an approaching
 *   obstacle.** That is why every lifetime here is short (the longest is 0.85 s)
 *   and why the loudest element, the flash, is also the shortest. An effect the
 *   player has to see *past* is a fairness bug, not decoration.
 * - Destruction feedback is load-bearing and is never removed under
 *   reduce-motion, only damped (`docs/GAME_DESIGN.md` §11.1).
 * - `Math.random()` is banned in `src/game/`. Every value here comes from the
 *   injected seeded `Rng`, so a run replays exactly from its seed.
 *
 * Every numeric constant below is **tunable**; each one carries the
 * player-experience goal it exists to serve.
 */

import { gameplay } from '../config/gameplay';
import type { Rng } from './Rng';
import type { Rect } from '../types';

/**
 * Particle kinds.
 *
 * 0-2 keep their historical values on purpose: the renderer switches on these
 * and a silent renumber would repaint every effect as a different one.
 */
/** Chunky angular debris from the impact. Cools from white-hot to deep red. */
export const PARTICLE_SHARD = 0;
/** The destroyed block itself — flash, detach, spin away, fall and fade. */
export const PARTICLE_CORE = 1;
/** Four-pointed sparkle star thrown out by a `+1`. */
export const PARTICLE_STAR = 2;
/** The hot core of the hit explosion. Brief and additive. */
export const PARTICLE_FLASH = 3;
/** Blue cube fragment of the destroyed block: tumbles and shrinks. */
export const PARTICLE_CHUNK = 4;
/** Gold/amber swirl ring of the collect glow. */
export const PARTICLE_RING = 5;

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /**
   * Current world-space size. Mutated by `grow`, so a fragment genuinely
   * shrinks as it tumbles rather than just fading at full size.
   */
  size: number;
  /** Seconds remaining. <= 0 means the slot is free. */
  life: number;
  maxLife: number;
  /** Rotation in radians, carried so shards tumble rather than slide. */
  rotation: number;
  spin: number;
  /**
   * Multiplier on `GRAVITY`. 0 is weightless — sparkles and rings hang where
   * the event happened, debris falls out of the play field.
   */
  gravity: number;
  /** Linear drag per second. 0 is ballistic. */
  drag: number;
  /** Size change in world units per second. Negative shrinks. */
  grow: number;
  /**
   * Stable 0..1 value assigned at spawn.
   *
   * Exists for the renderer: pool slots are handed out by availability, so a
   * particle's index in the packed array shifts as its neighbours die. Deriving
   * a shard's silhouette from its index would make that silhouette flicker.
   * This is the one per-particle value that never changes.
   */
  seed: number;
  kind: number;
  active: boolean;
};

const TAU = Math.PI * 2;

/**
 * World units per second squared. Tuned so debris clears the play field in
 * roughly the time the flash takes to fade — the goal is a burst that is over
 * quickly, not a shower the player has to look through.
 */
const GRAVITY = 2600;

/**
 * Per-block emission budget. Total 10, against a pool of
 * `gameplay.maxParticles`, so a simultaneous loss of a full stack still fits.
 *
 * Claim order in `burst` is importance order, so a saturated pool sheds the
 * decorative debris first and keeps the alarm and the block itself.
 */
const SHARDS_PER_BLOCK = 5;
const CHUNKS_PER_BLOCK = 3;

/** Per-collect budget. Total 9. */
const STARS_PER_COLLECT = 7;
/** Two, counter-rotating: a single ring reads as a bubble, two read as a swirl. */
const RINGS_PER_COLLECT = 2;

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
    gravity: 0,
    drag: 0,
    grow: 0,
    seed: 0,
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
 * Clears every field of a claimed slot.
 *
 * Load-bearing, not hygiene: slots are reused across *kinds*, so without this a
 * weightless sparkle could inherit the gravity of the shard that last occupied
 * its slot and drop out of the frame.
 */
function reset(p: Particle): void {
  p.x = 0;
  p.y = 0;
  p.vx = 0;
  p.vy = 0;
  p.size = 0;
  p.life = 0;
  p.maxLife = 1;
  p.rotation = 0;
  p.spin = 0;
  p.gravity = 0;
  p.drag = 0;
  p.grow = 0;
  p.seed = 0;
  p.kind = PARTICLE_SHARD;
}

/**
 * Bursts a destroyed block: the sheet's Hit Explosion and Block Destroy,
 * emitted together because they are one event.
 *
 * Mutates the pool in place — allocating a fresh array 60 times a second is
 * exactly the garbage the frame budget cannot afford.
 */
export function burst(pool: Particle[], rect: Rect, rng: Rng): void {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const unit = rect.width;

  // --- Hit Explosion: the hot core. Claimed first because it is the single
  //     most informative pixel of the whole effect — it marks *where* the hit
  //     landed. Deliberately the shortest-lived thing here: it is an alarm, and
  //     an alarm that lingers is glare over the next obstacle (§11).
  const flash = claim(pool);
  if (flash) {
    reset(flash);
    flash.x = cx;
    flash.y = cy;
    // Barely moves. It marks a place, it does not travel.
    flash.vx = rng.nextRange(-40, 40);
    flash.vy = rng.nextRange(-80, -10);
    flash.size = unit * 1.1;
    // Expands ~40% as it dies, so it reads as a detonation rather than a
    // light being switched off.
    flash.grow = unit * 2.2;
    flash.maxLife = rng.nextRange(0.15, 0.21);
    flash.life = flash.maxLife;
    flash.drag = 3;
    flash.seed = rng.next();
    flash.kind = PARTICLE_FLASH;
    flash.active = true;
  }

  // --- Block Destroy: stages 2-5, the block detaching and spinning away.
  const core = claim(pool);
  if (core) {
    reset(core);
    core.x = cx;
    core.y = cy;
    core.vx = rng.nextRange(-70, 170);
    core.vy = rng.nextRange(-640, -300);
    // Matches how a live block is actually drawn: the renderer insets cubes to
    // CUBE_FILL of their slot, so a core at the full slot width came out 14%
    // bigger than the block it replaced — and being red and glowing, read
    // bigger still. A destroyed block must not loom larger than a living one.
    core.size = unit * 0.86;
    // Recedes as it goes: the sheet's Falling/Destroyed row ends on a small,
    // greyed cube, not a full-size one.
    core.grow = -unit * 0.4;
    // Short enough to be gone before the next obstacle needs reading
    // (`docs/GAME_DESIGN.md` §11).
    core.maxLife = rng.nextRange(0.5, 0.68);
    core.life = core.maxLife;
    core.spin = rng.nextRange(-9, 9);
    core.gravity = 1;
    core.seed = rng.next();
    core.kind = PARTICLE_CORE;
    core.active = true;
  }

  // --- Hit Explosion: chunky angular debris.
  for (let i = 0; i < SHARDS_PER_BLOCK; i += 1) {
    const p = claim(pool);
    if (!p) return;
    reset(p);

    // Evenly spread with jitter rather than fully random. A uniform draw
    // clumps often enough that roughly one burst in three read as a splash to
    // one side; an even radial star is what the eye accepts as an explosion.
    const angle = (i / SHARDS_PER_BLOCK) * TAU + rng.nextRange(-0.5, 0.5);
    const speed = rng.nextRange(260, 720);
    const size = unit * rng.nextRange(0.17, 0.32);

    // Start slightly off-centre along its own heading, so the debris leaves a
    // visible hole rather than all emanating from one point.
    p.x = cx + Math.cos(angle) * unit * 0.18;
    p.y = cy + Math.sin(angle) * unit * 0.18;
    p.vx = Math.cos(angle) * speed;
    // Bias upward so the burst reads as an explosion, not a drip.
    p.vy = Math.sin(angle) * speed - rng.nextRange(140, 400);
    p.size = size;
    p.grow = -size * 0.55;
    p.maxLife = rng.nextRange(0.26, 0.46);
    p.life = p.maxLife;
    p.rotation = rng.nextRange(0, TAU);
    p.spin = rng.nextRange(-17, 17);
    p.gravity = 1.3;
    // Air resistance, so the launch reads as a *pop* that immediately slows
    // rather than a constant-velocity slide.
    p.drag = 1.4;
    p.seed = rng.next();
    p.kind = PARTICLE_SHARD;
    p.active = true;
  }

  // --- Block Destroy: blue cube fragments, tumbling and shrinking.
  //     Slower and longer-lived than the red debris on purpose. The explosion
  //     is the punctuation; these are the sentence, and the player needs long
  //     enough to register that the pieces are the same blue as his stack.
  for (let i = 0; i < CHUNKS_PER_BLOCK; i += 1) {
    const p = claim(pool);
    if (!p) return;
    reset(p);

    const angle = (i / CHUNKS_PER_BLOCK) * TAU + rng.nextRange(-0.7, 0.7);
    const speed = rng.nextRange(120, 330);
    const size = unit * rng.nextRange(0.2, 0.33);

    p.x = cx + rng.nextRange(-unit / 4, unit / 4);
    p.y = cy + rng.nextRange(-unit / 4, unit / 4);
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed - rng.nextRange(90, 260);
    p.size = size;
    // Down to roughly a third of its spawn size — "tumbling and shrinking".
    p.grow = -size * 0.85;
    p.maxLife = rng.nextRange(0.5, 0.78);
    p.life = p.maxLife;
    p.rotation = rng.nextRange(0, TAU);
    p.spin = rng.nextRange(-11, 11);
    p.gravity = 0.85;
    p.drag = 0.5;
    p.seed = rng.next();
    p.kind = PARTICLE_CHUNK;
    p.active = true;
  }
}

/**
 * The sheet's Collect Glow and Star Particles, when a `+1` is picked up.
 *
 * Shaped to be unmistakable *against* the hit burst at a glance: this one
 * expands as a clean ring and drifts upward, where a hit sprays outward and
 * falls. A player who cannot tell a gain from a loss in peripheral vision has
 * to look away from the obstacles to find out, which is exactly the cost §11
 * is trying to avoid.
 */
export function sparkle(
  pool: Particle[],
  x: number,
  y: number,
  size: number,
  rng: Rng,
): void {
  // --- Collect Glow: counter-rotating swirl rings.
  for (let i = 0; i < RINGS_PER_COLLECT; i += 1) {
    const p = claim(pool);
    // `break`, not `return`: the stars are the louder half of the cue and are
    // worth trying for even when the rings could not be placed.
    if (!p) break;
    reset(p);

    p.x = x;
    p.y = y;
    p.size = size * (0.34 + i * 0.16);
    p.grow = size * (2.4 - i * 0.7);
    p.maxLife = 0.42 + i * 0.1;
    p.life = p.maxLife;
    p.rotation = rng.nextRange(0, TAU);
    // Opposite spins, so the two tilted ellipses cross. One alone is a bubble.
    p.spin = (i % 2 === 0 ? 1 : -1) * rng.nextRange(3.5, 6);
    p.seed = rng.next();
    p.kind = PARTICLE_RING;
    p.active = true;
  }

  // --- Star Particles.
  for (let i = 0; i < STARS_PER_COLLECT; i += 1) {
    const p = claim(pool);
    if (!p) return;
    reset(p);

    const angle = (i / STARS_PER_COLLECT) * TAU + rng.nextRange(-0.28, 0.28);
    const speed = rng.nextRange(200, 420);
    const s = size * rng.nextRange(0.14, 0.28);

    p.x = x + Math.cos(angle) * size * 0.2;
    p.y = y + Math.sin(angle) * size * 0.2;
    p.vx = Math.cos(angle) * speed;
    // Lift. A reward rises; a symmetric spray reads as a splat.
    p.vy = Math.sin(angle) * speed - rng.nextRange(30, 110);
    p.size = s;
    p.grow = -s * 0.5;
    p.maxLife = rng.nextRange(0.34, 0.56);
    p.life = p.maxLife;
    p.rotation = rng.nextRange(0, TAU);
    // Slow. A four-pointed star spinning fast stops being a star and becomes a
    // flickering disc.
    p.spin = rng.nextRange(-3.5, 3.5);
    p.drag = 3.6;
    // A whisper of weight, so sparkles settle instead of hanging in the lane.
    p.gravity = 0.08;
    p.seed = rng.next();
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

    if (p.drag > 0) {
      // Clamped, so a long frame can only ever stop a particle, never reverse it.
      const keep = 1 - Math.min(1, p.drag * dt);
      p.vx *= keep;
      p.vy *= keep;
    }
    if (p.gravity !== 0) p.vy += GRAVITY * p.gravity * dt;

    p.x += p.vx * dt - scrollX;
    p.y += p.vy * dt;
    p.rotation += p.spin * dt;

    if (p.grow !== 0) {
      p.size += p.grow * dt;
      if (p.size < 0) p.size = 0;
    }
  }
}

export function clearParticles(pool: Particle[]): void {
  for (let i = 0; i < pool.length; i += 1) {
    pool[i]!.active = false;
    pool[i]!.life = 0;
  }
}
