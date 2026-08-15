/**
 * Difficulty-independent gameplay constants.
 * Balance data owned by the Game Designer (`docs/RACI.md` row 4).
 */

export const gameplay = {
  /** Logical world units. Rendering scales this to device pixels
   *  (`docs/ARCHITECTURE.md` §4), so gameplay is resolution-independent. */
  worldWidth: 1000,
  worldHeight: 1800,

  /** Player X stays fixed near the left quarter; the world scrolls left.
   *  This preserves "the stack moves right" without unbounded coordinates. */
  playerX: 250,

  blockSize: 72,

  /** World units per second at speedMultiplier 1.0. */
  baseSpeed: 420,

  /** Vertical drag responsiveness. Movement must feel immediate but smooth. */
  dragFollowStrength: 18,

  /**
   * Ceiling on vertical travel, world units per second.
   *
   * Doubles as the fairness validator's model of what the player can achieve:
   * an opening is only reachable if the stack can physically get there in the
   * time before the obstacle arrives. Raising this makes the game easier *and*
   * loosens validation, so change it deliberately.
   */
  maxVerticalSpeed: 2200,

  /**
   * Frame delta ceiling, in seconds.
   *
   * Load-bearing, not a nicety: returning from background produces a delta of
   * many seconds, which without this clamp would advance the world far enough
   * to teleport the stack through a wall. QA Plan test #15.
   */
  maxFrameDelta: 1 / 30,

  /** Difficulty ramp with distance (`docs/GAME_DESIGN.md` §8). */
  speedRampPerMetre: 0.00004,
  maxSpeedRamp: 1.6,

  /** Caps that bound worst-case frame cost (`docs/ARCHITECTURE.md` §9). */
  maxActiveObstacles: 8,
  maxParticles: 120,

  /** Distance ahead of the player at which obstacles spawn. Must exceed the
   *  reaction distance the fairness validator requires. */
  spawnAheadDistance: 1200,
  despawnBehindDistance: 200,
} as const;
