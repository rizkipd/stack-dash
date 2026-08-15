# QA Report — M0 Project Bootstrap

Template per `docs/QA_PLAN.md`.

## Ticket

M0 — Project Bootstrap (`docs/MVP_BACKLOG.md`)

## Build / Commit

`aed455d` — feat(M0): bootstrap Expo + TypeScript project skeleton

## Environment

- macOS (darwin 25.5.0), arm64
- Node 22.23.2 via fnm, pinned by `.node-version`
- Expo SDK 57.0.13 · React Native 0.86.2 · TypeScript 6.0.3
- No Xcode (Command Line Tools only), no Android SDK, Java 11

## Result

**PASS — with one acceptance criterion outstanding** (see *Not Verified*).

## Acceptance criteria

> **M0 acceptance:** app launches on both platforms and navigates between
> placeholder screens.

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Expo + React Native + TypeScript project created | PASS | `package.json`, `tsconfig.json` with `strict: true` |
| 2 | Lint / typecheck / test commands configured | PASS | `npm run check` runs all three |
| 3 | Repository structure per `ARCHITECTURE.md` §3 | PASS | `app/`, `src/game/{types,config,engine}`, `src/{storage,theme,components}`, `tests/` |
| 4 | Navigation added | PASS | expo-router; six routes registered in `app/_layout.tsx` |
| 5 | Placeholder screens present | PASS | Menu, Difficulty, Game, Game Over, Settings, Shop |
| 6 | Android dev build confirmed | **PARTIAL** | Bundles clean; not yet launched on a device |
| 7 | iOS dev build confirmed | **PARTIAL** | Bundles clean; not yet launched on a device |

## Checks run

```
npm run typecheck   → pass, 0 errors
npm run lint        → pass, 0 findings
npm test            → 4 suites, 43 tests, all pass
npx expo export --platform ios      → 1566 modules bundled, no errors
npx expo export --platform android  → 1654 modules bundled, no errors
```

A clean bundle is meaningful evidence: every import resolves, all six
expo-router routes register, and Skia, Reanimated, Gesture Handler and
AsyncStorage all load. It is **not** proof the app renders correctly on
hardware.

## Test coverage against `docs/QA_PLAN.md`

Critical tests reachable without gameplay code:

| QA Plan # | Test | Result |
|---|---|---|
| 1 | Stack starts with correct count per difficulty | PASS — all four tiers |
| 9 | Zero-block Game Over fires once | PARTIAL — `gameOverEmitted` guard exists and the phase machine rejects re-entry; the runtime path lands in M3 |
| 10 | Retry resets score, stack, obstacles, collectibles | PASS |
| 16 | Seeded generation is reproducible | PASS — 9 RNG tests |
| — | Corrupt/missing local save data | PASS — 11 storage tests |

Tests 2-8, 11-15, 17-18 depend on gameplay code and are deferred to their
milestones.

## Defects found and fixed during M0

| Severity | Issue | Resolution |
|---|---|---|
| Blocker | Node 20.12.0 installed; RN 0.86/Metro require `^22.13.0 \|\| ^24.3.0 \|\| >=26.0.0` | fnm + Node 22.23.2, pinned via `.node-version` |
| Critical | `react-dom@19.2.8` resolved transitively against `react@19.2.3`, breaking every subsequent `npm install` | Pinned `react-dom` to the SDK's 19.2.3 |
| Major | `react-test-renderer@19.2.8` requires `react@^19.2.8`; unsatisfiable | Dropped — legacy in React 19 and unnecessary for pure-logic tests |
| Minor | `@types/jest` resolved to v30 against jest v29 | Aligned to `^29.5.14` |
| Minor | `@types/jest` not auto-included; 60+ phantom `Cannot find name 'describe'` errors | Added `types: ["jest", "node"]` to tsconfig |
| Minor | Storage tests failed on `NativeModule: AsyncStorage is null` | Registered the official mock in `jest.setup.js` |

## Not verified

**Criteria 6 and 7 are not fully closed.** The app has not been launched on a
physical iPhone or Android device. This requires the Product Owner to run
`npm start` and scan the QR code in Expo Go — no Xcode or Android SDK is
needed, since Skia is included in Expo Go.

Until that happens, "app launches on both platforms" is supported by bundle
evidence only. Per `docs/QA_PLAN.md`, QA does not mark a criterion PASS on
inference.

Also unverified, and correctly deferred: gesture handling, frame pacing, safe
areas on notched devices, and background/resume behaviour. None have runtime
code at M0.

## Severity

No Blocker or Critical defects outstanding. The two Major items were resolved
during the milestone.

## Regression risk

Low. No gameplay logic exists yet to regress. The dependency pins are the
fragile surface: a future `npm install <pkg>@latest` that bypasses
`npx expo install` will desynchronise the native layer. `docs/RACI.md` row 7
makes the Architect accountable for that gate.

## Recommendation

**Proceed to M0 sign-off once the Product Owner confirms the app boots on both
devices.** Do not begin M1 until then — `MASTER_PROMPT.md` sets an explicit
stop condition at M0.
