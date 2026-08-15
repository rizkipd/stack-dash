# QA Report — M1 through M8 (Playable MVP)

Template per `docs/QA_PLAN.md`.

## Ticket

M1-M8 — core gameplay through polish (`docs/MVP_BACKLOG.md`)

## Build / Commit

Working tree at the close of the M1-M8 build. Expo SDK 57.0.13,
React Native 0.86.2, Node 22.23.2.

## Result

**PASS on logic — device verification outstanding.**

Every automated gate is green. Nothing has been run on hardware, so anything
that can only fail on a device is untested. That distinction is the whole of
this report.

## Checks run

```
npm run typecheck   → pass, 0 errors
npm run lint        → pass, 0 findings
npm test            → 7 suites, 106 tests, all pass
npx expo export --platform ios      → 1878 modules, no errors
npx expo export --platform android  → 1966 modules, no errors
```

## Acceptance criteria

| Milestone | Acceptance | Result |
|---|---|---|
| M1 | Stack moves smoothly up/down while the game advances | **PASS (logic)** — bounds and frame-rate independence tested; *feel* is a device question |
| M2 | Partial collision removes only touching blocks | **PASS** — asserted both directions: every reported index overlaps, every unreported one does not |
| M3 | Zero blocks triggers Game Over once; Retry fully resets | **PASS** — fires exactly once across 120 frames; reset clears score, obstacles, collectibles, particles, shake |
| M4 | Randomised sequences stay valid under automated tests | **PASS** — 250 seeds × 4 difficulties, every emitted obstacle passable |
| M5 | Collectible adds exactly one block, never twice | **PASS** |
| M6 | Distance score, best score, per-tier config, ramps, persistence | **PASS** — persistence tested at the parse layer |
| M7 | All screens, HUD, pause, safe areas | **PASS (build)** — layout unverified on hardware |
| M8 | Particles, haptics, sound, music, animations | **PASS (build)** — no audio has been *heard* |

## Coverage against `docs/QA_PLAN.md`

| # | Test | Result |
|---|---|---|
| 1 | Correct starting count per difficulty | PASS |
| 2 | Drag changes only vertical position | PASS — X is never written by movement |
| 3 | Stack never exits bounds | PASS — incl. 1800 frames hammering both limits |
| 4 | Obstacles spawn ahead, not on the player | PASS — 100 seeds |
| 5 | One colliding block removes exactly one | PASS |
| 6 | Multiple colliding blocks remove only those | PASS |
| 7 | A block cannot be removed twice | PASS — overlapping obstacles yield unique indices |
| 8 | Non-colliding blocks survive | PASS |
| 9 | 1 → 0 triggers Game Over once | PASS |
| 10 | Retry resets everything | PASS |
| 11 | +1 adds exactly one block | PASS |
| 12 | Collectible cannot be collected twice | PASS |
| 13 | Pause freezes simulation | PASS |
| 14 | Resume continues correctly | PASS |
| 15 | Background/resume causes no giant delta | PASS — a 30 s delta advances identically to one clamped frame |
| 16 | Seeded generation reproducible | PASS — incl. a full 15 s run replaying identically |
| 17 | Sequences pass fairness validation | PASS |
| 18 | High score persists across restart | **PARTIAL** — parse/merge logic tested; real AsyncStorage round-trip is a device test |

Stress cases covered in automation: 1 remaining block, large stack, two
collisions in one frame, very high speed, simulated low FPS (1/31 s deltas),
corrupt/missing save data.

## Design decisions worth flagging

1. **Game Over is an overlay, not a route.** `app/game-over.tsx` was deleted.
   `docs/GAME_DESIGN.md` §2 makes fast retry a design pillar — routing away
   and back tears down and rebuilds the engine, so Retry is now genuinely one
   tap on a live run.

2. **Survivors keep their screen position when blocks are destroyed.** The
   stack re-centres on the surviving blocks' centroid rather than holding its
   old centre. Without this, losing blocks from one end shunts the survivors
   sideways — potentially into the very wall that killed their neighbours,
   killing them next frame for a collision they never had. The count invariant
   is untouched: only colliding blocks are removed.

3. **The fairness validator models player reach**, using
   `gameplay.maxVerticalSpeed`. Raising that constant makes the game easier
   *and* loosens validation simultaneously — it is not a free knob.

4. **Rotation is presentational only.** The 3D tumble, phase offsets and lean
   are computed in `renderState.ts` from simulation values. No rule depends on
   them; the game plays identically with rotation at zero.

## Not verified — needs hardware

- **Frame rate.** The architecture targets 60 FPS with the simulation on the JS
  thread publishing to a shared value and all drawing in a Skia worklet. That
  design is sound but unproven; per-frame cube projection is the thing to watch
  on a low-end Android.
- **Gestures.** Incremental `onChange` dragging has never received a real touch.
- **Audio.** Not one cue has been heard. The files are synthesised placeholders
  (see `docs/AUDIO_BRIEF.md`).
- **Haptics.** Untested; Android support is inconsistent by nature.
- **Safe areas** on notched and tall devices.
- **Background/resume** as a real OS event rather than a simulated delta.
- **AsyncStorage** round-trip across an actual app restart.

## Severity

No Blocker or Critical defects outstanding.

One **Major risk**, not a defect: the render path is unexercised on hardware.
If it does not hold 60 FPS, the fallback is documented in `src/game/README.md`
— the simulation is dependency-free plain TypeScript specifically so it can be
moved into a worklet without a rewrite.

## Regression risk

Moderate and concentrated in two places:

- **The collision path.** Its invariant is the one most likely to be broken
  silently by an optimisation. It is well covered; keep it that way.
- **Dependency pinning.** A future `npm install <pkg>@latest` that bypasses
  `npx expo install` will desynchronise the native layer. `docs/RACI.md` row 7
  makes the Architect accountable for that gate.

## Recommendation

**Play it on a device before anything else.** The next real question is not a
test result, it is whether the core loop is fun — which is exactly the gate
M1-M3 were bundled to reach.

Proceed to M9 (device QA) only after the Product Owner has confirmed the game
feels right. If it does not, tuning `src/game/config/*.ts` is cheap and no
engine code needs to change.
