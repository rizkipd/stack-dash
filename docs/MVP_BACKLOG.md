# Stack Dash --- MVP Backlog

## M0 --- Project Bootstrap

-   [ ] Create Expo + React Native + TypeScript project
-   [ ] Configure lint/typecheck/test commands
-   [ ] Create repository structure
-   [ ] Add navigation
-   [ ] Add placeholder screens
-   [ ] Confirm Android dev build
-   [ ] Confirm iOS dev build

**Acceptance:** app launches on both platforms and navigates between
placeholder screens.

## M1 --- Core Stack & Input

-   [ ] Render vertical stack
-   [ ] Configure starting block count
-   [ ] Implement vertical drag
-   [ ] Clamp to gameplay bounds
-   [ ] Implement automatic forward/world movement

**Acceptance:** player can smoothly move stack up/down while game
advances automatically.

## M2 --- Obstacles & Collision

-   [ ] Implement obstacle entity
-   [ ] Implement initial patterns
-   [ ] Spawn obstacles ahead
-   [ ] Per-block collision
-   [ ] Remove only collided blocks
-   [ ] Add collision feedback

**Acceptance:** partial collision removes only touching blocks;
surviving blocks continue.

## M3 --- Lifecycle

-   [ ] READY
-   [ ] PLAYING
-   [ ] PAUSED
-   [ ] GAME_OVER
-   [ ] Retry
-   [ ] Home

**Acceptance:** reaching zero triggers Game Over once; Retry fully
resets run.

## M4 --- Controlled Random Generation

-   [ ] Pattern library
-   [ ] Seedable RNG
-   [ ] Pattern variation
-   [ ] Fairness validator
-   [ ] Offscreen cleanup

**Acceptance:** randomized sequences remain valid under automated
generation tests.

## M5 --- Collectible Blocks

-   [ ] Spawn +1 collectible
-   [ ] Detect collection
-   [ ] Add block
-   [ ] Collect animation/SFX

**Acceptance:** collectible increases stack by exactly one and cannot be
collected twice.

## M6 --- Difficulty & Score

-   [ ] Distance score
-   [ ] Best score
-   [ ] Easy/Medium/Hard config
-   [ ] Distance-based speed scaling
-   [ ] Frequency/gap scaling
-   [ ] Local persistence

## M7 --- UI/UX

-   [ ] Main Menu
-   [ ] Difficulty Select
-   [ ] HUD
-   [ ] Pause overlay
-   [ ] Game Over
-   [ ] Settings
-   [ ] Safe-area support

## M8 --- Polish

-   [ ] Particles
-   [ ] Haptics
-   [ ] Sound
-   [ ] Music
-   [ ] Block break animation
-   [ ] Collect animation
-   [ ] UI transitions

## M9 --- Mobile QA

-   [ ] Android physical-device test
-   [ ] iPhone physical-device test
-   [ ] Multiple aspect ratios
-   [ ] Background/resume
-   [ ] Repeated restart
-   [ ] Low-FPS/high-delta behavior
-   [ ] Performance profiling

## M10 --- Release Candidate

-   [ ] App icon
-   [ ] Splash
-   [ ] Versioning
-   [ ] Privacy review
-   [ ] Store screenshots
-   [ ] Android release build
-   [ ] iOS release build
