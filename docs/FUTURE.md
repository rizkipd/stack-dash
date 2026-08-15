# Stack Dash --- Post-MVP Backlog (Parked)

Everything on this page is **out of scope for the MVP**. It is recorded
here so the ideas in `image.png` are not lost, not because they are
approved.

## The Gate

Nothing on this page may begin until **all** of the following are true:

1.  The MVP has shipped through M10.
2.  The Product Owner has confirmed the core loop is fun on real
    hardware.
3.  The Product Owner has signed a dated amendment in `CLAUDE.md`
    relaxing the relevant MVP Non-Goal.

Rationale: every hour spent on an economy before the core loop is proven
is an hour spent monetising a game that may not be worth playing. The
MVP exists to answer one question --- *is dragging a stack of blocks
past walls fun?* --- as fast as possible.

## Parked from `image.png`

The design sheet includes a monetisation layer that `CLAUDE.md` lists
under MVP Non-Goals. It is captured here in full.

### Economy

-   **Coins.** The mockup shows a `1245` coin counter in the Main Menu
    header. Needs an earn rate, a sink, and persistence.
-   **Shop.** The MVP ships a visibly locked SHOP button
    (Amendment A-2026-08-15-2). Making it functional requires an item
    catalogue, purchase flow, ownership persistence and an equipped-item
    concept.
-   **Block skins.** The palette strip in the style guide implies
    recolourable player blocks. Cheapest real shop item; the renderer
    should keep block colour a parameter so this stays easy.

### Monetisation

-   **Interstitial ads.** Highest risk to game feel. A fast-retry game
    lives or dies on retry latency; an interstitial between runs
    directly attacks the "one more run" loop. If ever added, gate on run
    count, never on every death.
-   **Remove-ads IAP.** Requires store configuration, receipt
    validation, and a restore-purchases flow on both platforms.
-   **Daily rewards.** Requires a trusted clock. Device-local time is
    trivially manipulated; doing this properly implies a backend, which
    is itself an MVP Non-Goal.

### Progression & social

-   Achievements
-   Online leaderboards
-   Daily challenge with a fixed seed --- cheap and natural, since the
    generator is seeded from day one (see `docs/ARCHITECTURE.md` §8)

## Parked from the asset & sound sheets (2026-08-15)

The later reference sheets introduced mechanics beyond the Locked Core
Concept. The Product Owner ruled **visual and feedback elements in, rule
changes out**, so these are recorded rather than built:

-   **Hearts / lives** (`❤️❤️🖤` in the HUD mock). A second health pool
    directly contradicts "0 blocks = Game Over" being the only fail
    state. Would need an amendment to the Locked Core Concept.
-   **Shield (1 hit)** power-up. Absorbing a collision contradicts "only
    blocks that geometrically collide are removed".
-   **Magnet (attract)** power-up. Needs a timed power-up state machine.
-   **+3 Blocks (gold)** collectible. The smallest of these — one extra
    type and a spawn weight — but the locked concept specifies
    collectibles add *one* block.
-   **Combo multiplier** (`COMBO x2`, `x3`) and **near-miss** scoring.
-   **Level counter** and the "Next Speed Up" progress bar. The MVP ramps
    difficulty continuously with distance rather than in discrete levels.
-   **Achievement unlock** cue and screen.

What *was* built from those sheets, being purely presentational: 360°
cube rotation, per-block phase offset, speed trails, glow, parallax
layers, hit explosion, star particles, screen shake, the
GREAT!/OOPS!/NEW BEST! banners, and the full audio cue set.

## Parked from `docs/GAME_DESIGN.md` §14

Gameplay ideas that extend the locked concept rather than monetise it:

-   Special blocks (shield, magnet, multiplier)
-   Moving / rotating obstacles
-   Multiple world themes and background variants
-   Themes beyond the neon night-city direction

## Notes for the MVP build

Two cheap decisions during MVP keep these doors open at near-zero cost.
Both are already in the plan:

-   **Keep block colour a render parameter**, not a constant --- makes
    skins a config change rather than a refactor.
-   **Keep the RNG seeded and injectable** --- makes a daily challenge a
    seed choice rather than a new system.

Do not build anything else on this page speculatively.
