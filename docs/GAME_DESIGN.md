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
| Easy       |              10 |
| Medium     |               8 |
| Hard       |               6 |
| Insane     |               5 |

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

| Mode   | Relative Speed | Gap        | Frequency | Starting Blocks |
| ------ | -------------: | ---------- | --------- | --------------: |
| Easy   |          0.85x | Large      | Low       |              10 |
| Medium |          1.00x | Medium     | Medium    |               8 |
| Hard   |          1.25x | Smaller    | High      |               6 |
| Insane |          1.55x | Very small | Very high |               5 |

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
