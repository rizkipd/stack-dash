# Stack Dash --- Technical Architecture

## 1. Target

One React Native/Expo TypeScript project targeting: - iOS - Android

## 2. Architectural Principle

Separate the **simulation** from the **presentation**.

``` text
Touch/Gesture
     ↓
Input Adapter
     ↓
Game Simulation
 ├─ Player/Stack System
 ├─ Movement System
 ├─ Collision System
 ├─ Obstacle Generator
 ├─ Collectible System
 ├─ Difficulty Manager
 └─ Score Manager
     ↓
Game State Snapshot
     ↓
Renderer + HUD
```

## 3. Suggested Repository Skeleton

``` text
stack-dash/
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── difficulty.tsx
│   ├── game.tsx
│   ├── game-over.tsx
│   └── settings.tsx
├── src/
│   ├── game/
│   │   ├── engine/
│   │   │   ├── GameEngine.ts
│   │   │   ├── GameLoop.ts
│   │   │   └── GameState.ts
│   │   ├── systems/
│   │   │   ├── MovementSystem.ts
│   │   │   ├── CollisionSystem.ts
│   │   │   ├── ObstacleGenerator.ts
│   │   │   ├── CollectibleSystem.ts
│   │   │   ├── DifficultyManager.ts
│   │   │   └── ScoreManager.ts
│   │   ├── entities/
│   │   │   ├── Block.ts
│   │   │   ├── PlayerStack.ts
│   │   │   ├── Obstacle.ts
│   │   │   └── Collectible.ts
│   │   ├── patterns/
│   │   │   ├── obstaclePatterns.ts
│   │   │   └── validatePattern.ts
│   │   ├── config/
│   │   │   ├── difficulty.ts
│   │   │   └── gameplay.ts
│   │   └── types/
│   │       └── index.ts
│   ├── components/
│   │   ├── game/
│   │   │   ├── GameCanvas.tsx
│   │   │   ├── StackView.tsx
│   │   │   ├── ObstacleView.tsx
│   │   │   └── CollectibleView.tsx
│   │   └── ui/
│   │       ├── HUD.tsx
│   │       ├── PauseOverlay.tsx
│   │       └── PrimaryButton.tsx
│   ├── hooks/
│   │   ├── useGameLoop.ts
│   │   └── useVerticalDrag.ts
│   ├── storage/
│   │   ├── highScore.ts
│   │   └── settings.ts
│   └── theme/
│       ├── colors.ts
│       └── spacing.ts
├── tests/
│   ├── collision.test.ts
│   ├── obstacle-generator.test.ts
│   ├── difficulty.test.ts
│   └── game-state.test.ts
├── docs/
├── .claude/
│   └── agents/
├── CLAUDE.md
├── package.json
├── tsconfig.json
└── app.json
```

## 4. Coordinate Model

Use a logical gameplay coordinate space independent of device pixels
where practical.

Recommended behavior: - player X remains visually around the left
quarter of the screen; - world objects move left relative to the player,
creating the appearance that the player travels right; - player controls
Y only; - scale rendering to device dimensions.

This avoids unbounded world coordinates while preserving the visual rule
"the stack moves to the right."

## 5. Entity Models

### Block

``` ts
type Block = {
  id: string;
  localIndex: number;
  active: boolean;
};
```

### PlayerStack

``` ts
type PlayerStack = {
  x: number;
  y: number;
  blockSize: number;
  blocks: Block[];
  verticalVelocity: number;
};
```

### Obstacle

``` ts
type Obstacle = {
  id: string;
  x: number;
  rects: Rect[];
  patternType: ObstaclePatternType;
  passed: boolean;
};
```

### Collectible

``` ts
type Collectible = {
  id: string;
  x: number;
  y: number;
  size: number;
  collected: boolean;
};
```

## 6. Collision

Use deterministic AABB/rectangle collision for MVP.

For every active player block: 1. derive its world rectangle; 2. test
against active obstacle rectangles; 3. mark collided block for removal;
4. after collision iteration, remove marked blocks; 5. emit/record a
single collision result; 6. if count is zero, request Game Over.

Do not mutate the block array while iterating collision candidates.

## 7. Game Loop

Prefer a fixed or bounded timestep strategy for simulation stability.

Pseudo-flow:

``` text
frame(delta)
  clamp delta
  process input
  update difficulty
  update player Y
  advance world objects
  spawn when needed
  detect collisions
  process collectibles
  update distance/score
  despawn offscreen objects
  evaluate game-over
  publish render state
```

## 8. Obstacle Generation

Use:
`Pattern Library → Random Selection → Parameter Variation → Fairness Validation → Spawn`

Do not use unconstrained random rectangles.

Generator should support seeded RNG in tests so QA can reproduce
failures.

## 9. Performance

-   Target 60 FPS.
-   Avoid React state updates every simulation tick if that causes
    excessive rerenders.
-   Keep hot-loop state in game-engine structures/refs.
-   Batch/publish render snapshots intentionally.
-   Reuse objects where practical.
-   Cap maximum active obstacles/particles.
-   Profile on physical Android and iPhone devices before release.

## 10. Persistence

MVP local-only: - best score by difficulty; - sound/haptics
preferences; - last selected difficulty.

## 11. Testing

Automated tests should prioritize pure logic: - per-block collision; -
zero-block transition; - obstacle fairness validation; - difficulty
progression; - scoring; - seeded generation reproducibility.

Device/manual tests cover: - gestures; - frame pacing; - safe areas; -
pause/background/resume; - Android/iOS rendering.
