# Stack Dash --- Master Prompt for Claude Code

You are starting development of **Stack Dash**.

First read: 1. `CLAUDE.md` 2. `docs/GAME_DESIGN.md` 3.
`docs/ARCHITECTURE.md` 4. `docs/MVP_BACKLOG.md` 5. `docs/QA_PLAN.md` 6.
all agent definitions under `.claude/agents/`

## Objective

Build the MVP incrementally using React Native + Expo + TypeScript for
Android and iOS.

## Required Team Workflow

Use the specialized agents: - PM - Game Designer - Architect - Gameplay
Programmer - Collision/Physics Programmer - Obstacle Programmer -
UI/UX - QA - Mobile/Release

## First Assignment

Start with **M0 only**.

1.  PM Agent:
    -   review M0;
    -   turn it into implementation tickets with acceptance criteria.
2.  Architect Agent:
    -   validate the proposed React Native/Expo architecture;
    -   make any necessary updates to `docs/ARCHITECTURE.md`;
    -   define exact packages needed for M0;
    -   avoid unnecessary dependencies.
3.  Implement M0:
    -   initialize Expo + TypeScript;
    -   create the agreed directory skeleton;
    -   configure navigation;
    -   create placeholder Main Menu, Difficulty, Gameplay, Game Over
        and Settings screens;
    -   add scripts for typecheck/test/lint where appropriate;
    -   preserve all documentation and agent files.
4.  QA Agent:
    -   run available checks;
    -   verify the app boots;
    -   verify navigation;
    -   report PASS/FAIL against M0 acceptance criteria.

## STOP CONDITION

After M0 QA: - If FAIL: fix M0 and retest. - If PASS: summarize the
completed work and STOP. - Do **not** begin M1 until the Product Owner
explicitly approves.

## Important Product Rules

The locked mechanic is: - vertical stack; - automatic left-to-right
travel; - player moves up/down; - random-but-fair walls; - only collided
blocks are lost; - collectibles can add blocks; - zero blocks means Game
Over.

Do not reinterpret this as a jumping game. Do not add shooting, combat,
multiplayer, login, ads, shops or backend services.
