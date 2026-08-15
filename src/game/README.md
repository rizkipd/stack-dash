# `src/game/` — the simulation

**This directory imports no React.** That is CLAUDE.md Architecture Rule 1,
and it is what makes `tests/` runnable without a renderer. It is also the
escape hatch if the render strategy has to move into a Reanimated worklet:
plain TypeScript can go there, React cannot.

Two more standing rules:

- **No `Math.random()`.** Use `engine/Rng.ts`, seeded and injectable, so QA can
  reproduce any failure from its seed.
- **Rendering reads state; it never defines rules.** Screens under `app/` may
  construct and read a `GameSnapshot`. They must not own collision, spawning or
  scoring logic.

## Layout

Per `docs/ARCHITECTURE.md` §3. Owners are from `docs/RACI.md`.

| Path | Owner | Milestone | Status |
| --- | --- | --- | --- |
| `types/` | Architect | M0 | ✅ done |
| `config/difficulty.ts` | Game Designer | M0 | ✅ done |
| `config/gameplay.ts` | Game Designer | M0 | ✅ done |
| `engine/GameState.ts` | Gameplay Programmer | M0 | ✅ shape + phase machine |
| `engine/Rng.ts` | Obstacle Programmer | M0 | ✅ done |
| `engine/GameEngine.ts` | Gameplay Programmer | M1-M3 | ⬜ |
| `engine/GameLoop.ts` | Gameplay Programmer | M1-M3 | ⬜ |
| `systems/MovementSystem.ts` | Gameplay Programmer | M1 | ⬜ |
| `systems/CollisionSystem.ts` | Collision Programmer | M2 | ⬜ |
| `systems/ObstacleGenerator.ts` | Obstacle Programmer | M2, M4 | ⬜ |
| `systems/CollectibleSystem.ts` | Gameplay Programmer | M5 | ⬜ |
| `systems/DifficultyManager.ts` | Gameplay Programmer | M6 | ⬜ |
| `systems/ScoreManager.ts` | Gameplay Programmer | M6 | ⬜ |
| `entities/` | per system owner | M1-M2 | ⬜ |
| `patterns/obstaclePatterns.ts` | Obstacle Programmer | M4 | ⬜ |
| `patterns/validatePattern.ts` | Obstacle Programmer | M4 | ⬜ |

Directories are created when their first module lands, rather than committed
empty.

## Invariants to preserve

These are the rules most likely to be broken silently by a later optimisation.
Each has, or will have, a test.

1. **Only blocks that geometrically collide are removed.** Partial collision
   must leave non-touching blocks alive. (`docs/GAME_DESIGN.md` §5)
2. **A block is never removed twice**, and reaching zero blocks fires Game Over
   **exactly once** — hence `gameOverEmitted`.
3. **The frame delta is clamped** to `gameplay.maxFrameDelta`. Returning from
   background otherwise advances the world far enough to teleport the stack
   through a wall. (QA Plan #15)
4. **Never mutate a collection while iterating collision candidates.**
5. **Generated sequences are validated before spawning**, at every difficulty
   including Insane. Speed may make a tier brutal, never unfair.
