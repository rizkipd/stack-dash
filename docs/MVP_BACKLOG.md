# Stack Dash --- MVP Backlog

## M0 --- Project Bootstrap

-   [x] Create Expo + React Native + TypeScript project
-   [x] Configure lint/typecheck/test commands
-   [x] Create repository structure
-   [x] Add navigation
-   [x] Add placeholder screens
-   [ ] Confirm Android dev build --- *bundles clean; awaiting device boot*
-   [ ] Confirm iOS dev build --- *bundles clean; awaiting device boot*

**Acceptance:** app launches on both platforms and navigates between
placeholder screens.

**Status:** QA reports PASS with two criteria outstanding ---
`docs/qa/M0-report.md`. Both need the Product Owner to run `npm start`
and open the app in Expo Go on a physical iPhone and Android. **Do not
begin M1 until M0 is signed off** (`MASTER_PROMPT.md` stop condition).

## M1 --- Core Stack & Input

-   [x] Render vertical stack
-   [x] Configure starting block count
-   [x] Implement vertical drag
-   [x] Clamp to gameplay bounds
-   [x] Implement automatic forward/world movement

**Acceptance:** player can smoothly move stack up/down while game
advances automatically.

## M2 --- Obstacles & Collision

-   [x] Implement obstacle entity
-   [x] Implement initial patterns
-   [x] Spawn obstacles ahead
-   [x] Per-block collision
-   [x] Remove only collided blocks
-   [x] Add collision feedback

**Acceptance:** partial collision removes only touching blocks;
surviving blocks continue.

## M3 --- Lifecycle

-   [x] READY
-   [x] PLAYING
-   [x] PAUSED
-   [x] GAME_OVER
-   [x] Retry
-   [x] Home

**Acceptance:** reaching zero triggers Game Over once; Retry fully
resets run.

## M4 --- Controlled Random Generation

-   [x] Pattern library
-   [x] Seedable RNG
-   [x] Pattern variation
-   [x] Fairness validator
-   [x] Offscreen cleanup

**Acceptance:** randomized sequences remain valid under automated
generation tests.

## M5 --- Collectible Blocks

-   [x] Spawn +1 collectible
-   [x] Detect collection
-   [x] Add block
-   [x] Collect animation/SFX

**Acceptance:** collectible increases stack by exactly one and cannot be
collected twice.

## M6 --- Difficulty & Score

-   [x] Distance score
-   [x] Best score
-   [x] Easy/Medium/Hard config
-   [x] Distance-based speed scaling
-   [x] Frequency/gap scaling
-   [x] Local persistence

## M7 --- UI/UX

-   [x] Main Menu
-   [x] Difficulty Select
-   [x] HUD
-   [x] Pause overlay
-   [x] Game Over
-   [x] Settings
-   [x] Safe-area support

## M8 --- Polish

-   [x] Particles
-   [x] Haptics
-   [x] Sound
-   [x] Music
-   [x] Block break animation
-   [x] Collect animation
-   [x] UI transitions

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
