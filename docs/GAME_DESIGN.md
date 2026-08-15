# Stack Dash --- Game Design Document

## 1. Elevator Pitch

**Avoid the walls. Keep your blocks. Don't reach zero.**

Stack Dash is a one-finger mobile survival game. A vertical stack of
blocks automatically moves from left to right while the player drags the
stack up and down to avoid randomly appearing obstacles. Any block that
touches a wall is lost. Survive as far as possible; if all blocks are
lost, the run ends.

## 2. Design Pillars

1.  **Understandable immediately** --- the player should understand the
    objective in seconds.
2.  **One-finger control** --- drag vertically; horizontal travel is
    automatic.
3.  **Fair randomness** --- unpredictable, but never impossible by
    accident.
4.  **Visible consequences** --- colliding blocks visibly
    break/fall/disappear.
5.  **Fast retry loop** --- Game Over to Retry should take one tap.
6.  **Increasing tension** --- speed and obstacle complexity rise over
    time.

## 3. Core Loop

`Start → Move Right → Obstacle Appears → Move Up/Down → Avoid or Lose Blocks → Collect Blocks → Increase Distance/Difficulty → Repeat → 0 Blocks → Game Over`

## 4. Player

### Stack

A vertical set of equal-sized blocks.

Suggested starting values:

| Difficulty | Starting Blocks |
| ---------- | --------------: |
| Easy       |               7 |
| Medium     |               6 |
| Hard       |               5 |
| Insane     |               4 |

These values are tunable configuration, not hard-coded game rules. They
live in `src/game/config/difficulty.ts`.

### Movement

-   Horizontal movement: automatic.
-   Player input: vertical drag.
-   Movement must feel immediate but smooth.
-   Clamp stack to playable vertical bounds.

## 5. Collision

-   Collision is evaluated per block.
-   A block intersecting a wall is removed.
-   Non-colliding blocks remain.
-   Multiple blocks may be lost during one obstacle encounter.
-   Collision must not remove the same block twice.
-   When remaining block count becomes zero, transition to Game Over
    exactly once.

## 6. Obstacles

MVP pattern families: - Bottom Wall - Top Wall - Center Wall - Gate /
Opening - Staggered Wall - Double Wall

Obstacle selection is randomized, but generation uses **pattern
templates** with tunable parameters.

### Fairness Rule

Before spawning, validate: - enough reaction distance/time; - a
traversable safe region exists; - consecutive patterns do not create an
unintended impossible combination; - obstacle does not spawn overlapping
the player.

## 7. Collectible Blocks

-   Optional glowing `+1` block collectible.
-   Collision with collectible increases stack count by one.
-   Collectible disappears after collection.
-   Spawn frequency is controlled by difficulty/balance configuration.

## 8. Difficulty

Difficulty changes: - horizontal speed; - obstacle spacing/frequency; -
gap/opening size; - obstacle pattern complexity; - collectible frequency
if desired.

Suggested initial tuning:

| Mode   | Relative Speed | Gap fraction | Frequency | Starting Blocks |
| ------ | -------------: | -----------: | --------- | --------------: |
| Easy   |          0.85x |         0.48 | Low       |               7 |
| Medium |          1.00x |         0.42 | Medium    |               6 |
| Hard   |          1.25x |         0.36 | High      |               5 |
| Insane |          1.55x |         0.30 | Very high |               4 |

### These three columns are coupled

`blockSize` (110), starting blocks and gap fraction cannot be tuned
independently. A tier's stack must fit through its own gap with clearance:

> `startingBlocks x blockSize + blockSize x 0.6  <  gapFraction x 1800`

| Tier | Stack | Gap | Needs | |
| --- | --: | --: | --: | --- |
| Easy | 770 | 864 | 836 | ok |
| Medium | 660 | 756 | 726 | ok |
| Hard | 550 | 648 | 616 | ok |
| Insane | 440 | 540 | 506 | ok |

Break that and nothing crashes --- which is the danger. The generator quietly
forces a wider opening on almost every spawn, pattern variety collapses, and
the game just gets duller. Re-run `npm run audit:fairness` after any change
here.

Counts came down from 10/8/6/5 when `blockSize` rose from 72 to 110 to match
the asset sheet, where a cube occupies far more of the screen.

`image.png` shows these as a 4 / 6 / 8 / 10 display scale. That is a
**UI presentation of speed for the player**, not the simulation value;
the simulation uses the relative multipliers above.

**Insane is subject to identical fairness validation.** A tier that can
generate an impossible layout is a defect at every difficulty --- speed
is allowed to make the game brutal, never unfair.

During a run, difficulty should also gradually increase with distance.

## 9. Scoring

Primary score: **distance survived**.

MVP: - Current distance - Best distance - Remaining blocks - Difficulty

## 10. Game States

`BOOT → MENU → DIFFICULTY_SELECT → READY → PLAYING ↔ PAUSED → GAME_OVER`

Restart from Game Over starts a fresh run using the same selected
difficulty.

## 11. Game Feel

Desired feedback: - small particle burst on block destruction; - brief
block-break animation; - subtle haptic feedback; - distinct collect
sound; - collision sound; - short Game Over feedback; - smooth UI
transitions.

Avoid excessive screen shake or effects that obscure obstacles.

### 11.1 Effect specification

The six effects of the design sheet's EFFECTS & PARTICLES panel, and the
job each one does. **All values are tunable starting points**; the
player-experience goal is the part that is fixed.

| Effect | Where | Budget | Life | Goal |
|---|---|---|---|---|
| **Hit Explosion** | `PARTICLE_FLASH` + `PARTICLE_SHARD` | 1 + 5 per block | 0.15-0.21 s / 0.26-0.46 s | The alarm. Marks *where* the hit landed, in the first frame, unmistakably. |
| **Block Destroy** | `PARTICLE_CORE` + `PARTICLE_CHUNK` | 1 + 3 per block | 0.6-0.85 s / 0.5-0.78 s | The receipt. Says *which of your blocks* you lost, in your own blue. |
| **Star Particles** | `PARTICLE_STAR` | 7 per collect | 0.34-0.56 s | Four-pointed sparkles. Reward, read peripherally. |
| **Collect Glow** | `PARTICLE_RING` | 2 per collect | 0.42 / 0.52 s | Gold/amber swirl. Says "pickup", not "hit". |
| **Speed Trail** | per-block, render side | — | — | Speed made visible without extra pool pressure. |
| **Screen Shake** | `GameEngine.shake` | — | ~0.3 s decay | Impact weight. Subtle; the play field must stay readable *during* it. |

Rules that outrank any of the values above:

1. **Nothing may obscure an approaching obstacle.** This is why the
   loudest element is also the shortest-lived, why every glow is
   additive rather than opaque, and why no effect lifetime exceeds
   0.85 s. An effect the player has to see *past* is a fairness bug,
   not decoration.
2. **A gain must never be mistakable for a loss.** The two are
   separated on shape and motion, not just colour: a collect expands
   as a clean ring and lifts, a hit sprays outward and falls. Colour
   alone fails for the ~8% of players with a red/green deficiency and
   fails for everyone in peripheral vision.
3. **Destruction feedback is load-bearing.** Under reduce-motion it is
   damped — shorter lives, smaller travel, no shake — never removed.
   Losing a block silently is a game that cannot be learned.
4. **The pool is fixed-capacity** (`gameplay.maxParticles`). The
   Speed Trail therefore stays a render-side effect: emitting trail
   particles every frame would let decoration crowd destruction
   feedback out of the pool, inverting rule 3.

## 12. Visual Direction

-   Portrait mobile layout.
-   Clean neon/night-city direction for initial prototype.
-   Player blocks: bright blue/cyan.
-   Obstacles: dark charcoal/gray.
-   Collectibles: luminous cyan/green.
-   Strong contrast between gameplay objects and background.

## 13. MVP Success Criteria

The prototype succeeds when: - a new player understands what to do
without lengthy instructions; - movement feels responsive; - collision
feels fair; - random obstacles feel varied but not arbitrary; - Retry is
immediate; - the game creates a natural "one more run" feeling.

## 14. Future Ideas --- Not MVP

-   Skins/themes
-   Coins
-   Daily challenge
-   Achievements
-   Leaderboards
-   Rewarded ads
-   Remove-ads purchase
-   Special blocks
-   Moving obstacles
-   Worlds/background themes
