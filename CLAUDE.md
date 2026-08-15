# Stack Dash --- Claude Code Project Constitution

## Mission

Build **Stack Dash**, a simple, polished, cross-platform mobile game for
**iOS and Android** using **React Native + Expo + TypeScript**.

## Product Owner

The human user is the Product Owner. The PM Agent coordinates work, but
must not change the core game concept without Product Owner approval.

## Locked Core Concept

-   A **vertical stack of blocks** automatically travels from **left to
    right**.
-   The player controls only the stack's **vertical position (up/down)**
    using touch/drag.
-   **Walls/obstacles appear randomly** ahead of the player.
-   The player tries to avoid walls and preserve as many blocks as
    possible.
-   Collision is **block-by-block**: only blocks that actually hit an
    obstacle are removed.
-   The run continues while at least one block remains.
-   **0 blocks = Game Over.**
-   Collectible `+1 block` items may appear and add one block to the
    stack.
-   Difficulty affects movement speed, obstacle frequency, opening size,
    and pattern complexity.
-   The primary score is **distance survived**.

## MVP Modes

-   Easy
-   Medium
-   Hard
-   Insane *(added by Amendment A-2026-08-15-1)*

## MVP Screens

1.  Splash/Boot
2.  Main Menu
3.  Difficulty Select
4.  Gameplay
5.  Pause
6.  Game Over
7.  Settings
8.  Shop --- **locked placeholder only**, no functionality
    *(added by Amendment A-2026-08-15-2)*

## MVP Non-Goals

Do NOT add these until the core game is fun and approved: -
Accounts/login - Backend/cloud database - Multiplayer - Online
leaderboard - Shop/skins - Ads - In-app purchases - Social features -
Complex story - Procedural generation that can create impossible layouts

## Technology

-   React Native
-   Expo
-   TypeScript
-   React Navigation / Expo Router
-   React Native Gesture Handler for touch/drag
-   React Native Reanimated for UI animation where appropriate
-   Prefer a performant 2D rendering layer such as React Native Skia for
    gameplay rendering if needed
-   Local persistence for settings/high score
-   Jest for deterministic game-logic tests where practical

## Architecture Rules

1.  Keep **game simulation logic independent from React components**.
2.  UI screens must not own collision or obstacle-generation rules.
3.  Use deterministic, testable TypeScript modules for:
    -   game state
    -   movement
    -   collision
    -   obstacle generation
    -   difficulty
    -   scoring
4.  Rendering reads game state; rendering should not define game rules.
5.  Prefer controlled-random obstacle **patterns + validation**, not
    unrestricted random coordinates.
6.  Avoid unnecessary dependencies.
7.  Optimize for stable 60 FPS on ordinary mobile devices.
8.  Keep gameplay portrait-first for MVP unless Product Owner changes
    this.

## Definition of Done

A feature is complete only when: - Acceptance criteria are satisfied. -
TypeScript/build checks pass. - Relevant automated tests pass. - No
known blocker or critical regression remains. - QA Agent reports PASS. -
Documentation is updated when behavior/architecture changes.

## Required Workflow

1.  PM Agent defines ticket and acceptance criteria.
2.  Game Designer reviews gameplay impact when applicable.
3.  Architect reviews technical design.
4.  Programmer implements.
5.  QA tests and reports PASS/FAIL.
6.  PM updates status.
7.  Do not proceed past a milestone with unresolved critical failures.

## Safety / Repository Rules

-   Never commit secrets, signing certificates, API keys, or store
    credentials.
-   Never delete major working functionality without explaining the
    reason.
-   Prefer small reviewable changes.
-   Do not silently alter locked gameplay rules.

## Ownership

Role accountability is defined in `docs/RACI.md`. Exactly one role is
**Accountable** for each work area. Any agent must escalate to the
Product Owner --- and must not decide unilaterally --- when a change
touches the Locked Core Concept, an MVP Non-Goal, or adds a runtime
dependency.

## Product Owner Amendments

Amendments to this constitution are **logged, never silent**. Each entry
records what changed, why, and the date of Product Owner approval.

### A-2026-08-15-1 --- Add Insane difficulty

**Approved:** 2026-08-15 · **Source:** `image.png` difficulty table

MVP Modes become Easy / Medium / Hard / **Insane**. Insane is
configuration only --- one row in `src/game/config/difficulty.ts` --- and
introduces no new systems. It remains subject to the same fairness
validation as every other mode; a mode that generates impossible layouts
is a defect regardless of tier.

### A-2026-08-15-2 --- Add locked Shop placeholder

**Approved:** 2026-08-15 · **Source:** `image.png` main-menu mockup

The Main Menu gains a third button, **SHOP**, rendered in a visibly
locked "coming soon" state to preserve the mockup's composition. It
navigates to a placeholder screen and nothing more.

**This does not relax the MVP Non-Goals.** Coins, the coin counter,
skins, a functioning shop, ads, in-app purchases and daily rewards
remain **forbidden** in the MVP. They are specified in `docs/FUTURE.md`
and are gated on the core loop being confirmed fun.

### A-2026-08-15-3 --- Rendering and toolchain

**Approved:** 2026-08-15

`image.png` depicts a **web** tech stack (Vite, React DOM, HTML5 Canvas,
Zustand, Howler.js, Framer Motion, React Router). This is superseded:
`image.png` is the **art direction of record, not the technology of
record**. The Mission's React Native + Expo mandate stands.

Resolved technology baseline:

-   **Expo SDK 57** / React Native 0.87.
-   **React Native Skia** is the gameplay rendering layer; React Native
    views + Reanimated render menus and HUD.
-   **Node ^22.13.0 || ^24.3.0 || >=26.0.0** --- required by React
    Native 0.87 and Metro. Node 20 is not supported.
-   Dependencies are installed with `npx expo install`, never
    `npm install <pkg>@latest`, so versions stay on the SDK-pinned set.
