# Stack Dash --- RACI

Who decides what. This document is owned by the **PM Agent** and is
referenced from `CLAUDE.md`.

## Key

| | Meaning |
| --- | --- |
| **R** | **Responsible** --- does the work |
| **A** | **Accountable** --- single owner; approves, and carries the outcome |
| **C** | **Consulted** --- input gathered *before* the decision |
| **I** | **Informed** --- told *after* the decision |

Two rules:

1.  **Exactly one A per row.** If two roles think they own something,
    nobody does.
2.  **A ≠ R is normal.** QA is accountable for the test suite; the
    programmer who owns the code writes the tests.

## Roles

| Short | Agent |
| --- | --- |
| PO | **Product Owner (the human)** |
| PM | `pm` |
| GD | `game-designer` |
| AR | `architect` |
| GP | `gameplay-programmer` |
| CP | `collision-physics-programmer` |
| OP | `obstacle-programmer` |
| UX | `ui-ux` |
| QA | `qa` |
| RL | `mobile-release` |

## Matrix

| # | Work area | PO | PM | GD | AR | GP | CP | OP | UX | QA | RL |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Scope, backlog, milestone gates | I | **A**/R | C | C | I | I | I | I | I | I |
| 2 | Locked Core Concept change | **A** | R | C | C | I | I | I | I | I | I |
| 3 | MVP Non-Goal relaxation | **A** | R | C | C | I | I | I | I | I | I |
| 4 | Rules, balance, difficulty values | I | C | **A**/R | I | C | I | C | I | C | I |
| 5 | Game feel / juice spec | I | C | **A**/R | I | C | I | I | R | C | I |
| 6 | Architecture, module boundaries | I | C | I | **A**/R | C | C | C | C | I | C |
| 7 | New runtime dependency | C | C | I | **A**/R | C | C | C | C | I | C |
| 8 | Engine, loop, state machine | I | I | C | C | **A**/R | C | I | I | C | I |
| 9 | Scoring & distance | I | C | C | C | **A**/R | I | I | I | C | I |
| 10 | Collectible behaviour | I | I | C | C | **A**/R | C | C | I | C | I |
| 11 | Local persistence (high score, settings) | I | I | I | C | **A**/R | I | I | C | C | I |
| 12 | Input adapter & vertical drag | I | I | C | C | **A**/R | C | I | R | C | I |
| 13 | Block/obstacle rects, AABB, bounds clamp | I | I | I | C | C | **A**/R | C | I | C | I |
| 14 | Pattern library, seeded RNG, spawn spacing | I | I | C | C | I | C | **A**/R | I | C | I |
| 15 | Fairness validator | I | I | C | C | I | C | **A**/R | I | C | I |
| 16 | Skia render layer | I | I | C | C | C | I | I | **A**/R | C | C |
| 17 | Screens, HUD, safe areas, navigation | I | C | C | C | I | I | I | **A**/R | C | I |
| 18 | Audio, SFX, music, haptics | I | I | C | I | I | I | I | **A**/R | C | I |
| 19 | Accessibility & reduce-motion | I | C | C | I | I | I | I | **A**/R | C | I |
| 20 | Logic test suite | I | I | I | C | R | R | R | R | **A** | I |
| 21 | PASS/FAIL milestone gate | I | C | I | I | I | I | I | I | **A**/R | I |
| 22 | Expo config, icons, splash, versioning | I | I | I | C | I | I | I | C | I | **A**/R |
| 23 | EAS builds & store readiness | C | C | I | I | I | I | I | I | C | **A**/R |
| 24 | Device performance profiling | I | I | I | C | C | C | C | C | R | **A**/R |
| 25 | Secrets & signing hygiene | I | I | I | I | I | I | I | I | C | **A**/R |

## Gaps this matrix closed

Recorded so they are not silently reintroduced. Before this document:

-   **Audio, SFX and music had no owner** at all, despite being required
    by M8. → Row 18, assigned to UI/UX, with Game Designer consulted on
    feel.
-   **Local persistence had no owner.** `src/storage/highScore.ts` and
    `src/storage/settings.ts` appear in the architecture skeleton but no
    agent claimed them. → Row 11, Gameplay Programmer.
-   **Fairness validation was split three ways** --- Game Designer
    defines "fair", Obstacle Programmer implements, QA verifies --- with
    no accountable party. → Row 15, Obstacle Programmer is accountable;
    the other two are consulted.
-   **Accessibility had no owner.** → Row 19, UI/UX.
-   **Dependency approval was a rule with no enforcer.** `CLAUDE.md`
    says "avoid unnecessary dependencies" but no role gated it. → Row 7,
    Architect.
-   **QA could not file a report.** The `qa` agent had no `Write` tool,
    yet `docs/QA_PLAN.md` defines a report template it was expected to
    produce. → `qa` is granted `Write`, restricted **by convention** to
    `docs/qa/**`. QA still never fixes what it finds; independence is
    preserved by that convention, and a QA agent editing source is
    itself a process defect.

## Escalation

Every agent carries this clause:

> Escalate to the Product Owner --- do not decide unilaterally --- when
> a change touches the **Locked Core Concept**, an **MVP Non-Goal**, or
> adds a **runtime dependency**.

Escalation path: **agent → PM → Product Owner.** The PM frames the
decision and its cost; the Product Owner decides. An approved decision
is logged as a dated amendment in `CLAUDE.md` (see *Product Owner
Amendments*). Rows 2, 3 and 7 exist to make that path mandatory rather
than optional.

## Workflow mapping

`CLAUDE.md` defines the required workflow. Each step maps to the
accountable role:

| Step | Accountable |
| --- | --- |
| 1. Define ticket + acceptance criteria | PM (row 1) |
| 2. Review gameplay impact | GD (rows 4-5) |
| 3. Review technical design | AR (rows 6-7) |
| 4. Implement | GP / CP / OP / UX (rows 8-19) |
| 5. Test, report PASS/FAIL | QA (rows 20-21) |
| 6. Update status | PM (row 1) |
| 7. Block on critical failure | QA (row 21) |

A milestone cannot close while QA reports a Blocker or Critical.
